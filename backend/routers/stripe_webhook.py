
import os
import logging
from datetime import datetime, timezone
from decimal import Decimal

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal
from models.subscription import (
    SubscriptionPlan,
    UserSubscription,
    SubscriptionPayment,
    StripeWebhookEvent,
)

load_dotenv()

logger = logging.getLogger(__name__)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(
    prefix="/subscriptions/stripe",
    tags=["Stripe Webhooks"],
)

PRICE_CONFIG = {
    ("customer", "Customer Premium"): (
        "STRIPE_CUSTOMER_PREMIUM_PRICE_ID",
        Decimal("799.00"),
    ),
    ("shop_owner", "Shop Owner Business"): (
        "STRIPE_SHOP_OWNER_BUSINESS_PRICE_ID",
        Decimal("15000.00"),
    ),
}


# =====================================
# HELPERS
# =====================================

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def from_timestamp(value):
    if value is None:
        return None

    return datetime.fromtimestamp(
        int(value),
        tz=timezone.utc,
    ).replace(tzinfo=None)


def stripe_to_dict(obj):
    if isinstance(obj, dict):
        return obj

    if hasattr(obj, "to_dict"):
        return obj.to_dict()

    raise ValueError("Unsupported Stripe object")


def stripe_id(value):
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        return value.get("id")

    if hasattr(value, "id"):
        return value.id

    return None


def get_invoice_subscription_id(invoice):
    parent = invoice.get("parent") or {}
    details = parent.get("subscription_details") or {}

    return stripe_id(
        details.get("subscription")
        or invoice.get("subscription")
    )


def expected_plan(db, subscription):
    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if not plan:
        raise ValueError("Local plan not found")

    config = PRICE_CONFIG.get(
        (plan.user_role, plan.name)
    )

    if not config:
        raise ValueError("Unsupported paid plan")

    env_name, expected_amount = config
    price_id = os.getenv(env_name)

    if not price_id:
        raise ValueError("Stripe price is not configured")

    if plan.price != expected_amount:
        raise ValueError("Local plan price mismatch")

    return plan, price_id, expected_amount


def verify_stripe_subscription(
    stripe_subscription,
    local_subscription,
    expected_price_id,
):
    remote = stripe_to_dict(stripe_subscription)

    remote_id = remote.get("id")
    customer_id = stripe_id(remote.get("customer"))

    if not remote_id or not customer_id:
        raise ValueError("Missing Stripe subscription details")

    metadata = remote.get("metadata") or {}

    if metadata.get("subscription_id") != str(
        local_subscription.id
    ):
        raise ValueError("Subscription metadata mismatch")

    if metadata.get("user_id") != str(
        local_subscription.user_id
    ):
        raise ValueError("User metadata mismatch")

    if (
        local_subscription.stripe_subscription_id
        and local_subscription.stripe_subscription_id
        != remote_id
    ):
        raise ValueError("Stripe subscription mismatch")

    if (
        local_subscription.stripe_customer_id
        and local_subscription.stripe_customer_id
        != customer_id
    ):
        raise ValueError("Stripe customer mismatch")

    items = (
        (remote.get("items") or {}).get("data") or []
    )

    if len(items) != 1:
        raise ValueError("Unexpected subscription items")

    item = items[0]
    price = item.get("price") or {}

    if stripe_id(price) != expected_price_id:
        raise ValueError("Stripe price ID mismatch")

    if item.get("quantity") != 1:
        raise ValueError("Unexpected subscription quantity")

    if price.get("currency") != "lkr":
        raise ValueError("Subscription currency mismatch")

    recurring = price.get("recurring") or {}

    if (
        recurring.get("interval") != "month"
        or recurring.get("interval_count", 1) != 1
    ):
        raise ValueError("Invalid billing interval")

    return remote_id, customer_id


# =====================================
# MATCH CHECKOUT TO LOCAL PAYMENT
# =====================================

def find_checkout_payment(db, remote_subscription):
    remote = stripe_to_dict(remote_subscription)

    metadata = remote.get("metadata") or {}

    try:
        local_id = int(metadata.get("subscription_id"))
        user_id = int(metadata.get("user_id"))
    except (ValueError, TypeError):
        return None, None

    subscription = db.get(
        UserSubscription,
        local_id,
    )

    if not subscription or subscription.user_id != user_id:
        return None, None

    payment = db.scalar(
        select(SubscriptionPayment)
        .where(
            SubscriptionPayment.subscription_id
            == subscription.id,
            SubscriptionPayment.stripe_checkout_session_id
            .is_not(None),
        )
        .order_by(SubscriptionPayment.id.desc())
    )

    if not payment:
        return None, None

    # Retrieve the original Checkout Session.
    session = stripe_to_dict(
        stripe.checkout.Session.retrieve(
            payment.stripe_checkout_session_id
        )
    )

    if session.get("id") != payment.stripe_checkout_session_id:
        raise ValueError("Checkout session mismatch")

    if session.get("mode") != "subscription":
        raise ValueError("Invalid checkout mode")

    if session.get("status") != "complete":
        return None, None

    if session.get("payment_status") != "paid":
        return None, None

    if stripe_id(session.get("subscription")) != remote["id"]:
        raise ValueError("Checkout subscription mismatch")

    if (
        stripe_id(session.get("customer"))
        != stripe_id(remote.get("customer"))
    ):
        raise ValueError("Checkout customer mismatch")

    if session.get("client_reference_id") != str(
        subscription.id
    ):
        raise ValueError("Checkout reference mismatch")

    session_metadata = session.get("metadata") or {}

    if (
        session_metadata.get("payment_id") != str(payment.id)
        or session_metadata.get("subscription_id")
        != str(subscription.id)
        or session_metadata.get("user_id")
        != str(subscription.user_id)
    ):
        raise ValueError("Checkout metadata mismatch")

    return subscription, payment


# =====================================
# CHECKOUT COMPLETED
# =====================================

def handle_checkout_completed(event, db):
    session = stripe_to_dict(event["data"]["object"])

    session_id = session.get("id")

    if not session_id:
        raise ValueError("Missing checkout session ID")

    payment = db.scalar(
        select(SubscriptionPayment)
        .where(
            SubscriptionPayment.stripe_checkout_session_id
            == session_id
        )
        .with_for_update()
    )

    if not payment:
        logger.warning(
            "Unknown checkout session: %s",
            session_id,
        )
        return

    subscription = db.get(
        UserSubscription,
        payment.subscription_id,
    )

    if not subscription:
        raise ValueError("Local subscription not found")

    metadata = session.get("metadata") or {}

    if (
        metadata.get("payment_id") != str(payment.id)
        or metadata.get("subscription_id")
        != str(subscription.id)
        or metadata.get("user_id")
        != str(subscription.user_id)
    ):
        raise ValueError("Checkout metadata mismatch")

    if session.get("mode") != "subscription":
        raise ValueError("Invalid checkout mode")

    if session.get("status") != "complete":
        return

    remote_id = stripe_id(session.get("subscription"))
    customer_id = stripe_id(session.get("customer"))

    if not remote_id or not customer_id:
        raise ValueError("Missing Stripe identifiers")

    _, price_id, _ = expected_plan(db, subscription)

    remote = stripe.Subscription.retrieve(remote_id)

    verified_id, verified_customer = (
        verify_stripe_subscription(
            remote,
            subscription,
            price_id,
        )
    )

    if verified_customer != customer_id:
        raise ValueError("Checkout customer mismatch")

    subscription.stripe_subscription_id = verified_id
    subscription.stripe_customer_id = verified_customer

    # Do not activate here.
    # Activation requires a verified paid invoice.

    logger.info(
        "Checkout linked: subscription=%s",
        subscription.id,
    )


# =====================================
# VERIFY INVOICE LINE AND BILLING PERIOD
# =====================================

def invoice_period(invoice, expected_price_id):
    lines = (
        (invoice.get("lines") or {}).get("data") or []
    )

    if len(lines) != 1:
        raise ValueError("Unexpected invoice line count")

    line = lines[0]

    pricing = line.get("pricing") or {}
    price_details = pricing.get("price_details") or {}

    line_price_id = (
        price_details.get("price")
        or stripe_id(line.get("price"))
    )

    if line_price_id != expected_price_id:
        raise ValueError("Invoice price mismatch")

    if line.get("quantity", 1) != 1:
        raise ValueError("Invoice quantity mismatch")

    period = line.get("period") or {}

    start = from_timestamp(period.get("start"))
    end = from_timestamp(period.get("end"))

    if not start or not end or end <= start:
        raise ValueError("Invalid invoice billing period")

    return start, end


# =====================================
# INVOICE PAID
# =====================================

def handle_invoice_paid(event, db):
    incoming = stripe_to_dict(event["data"]["object"])

    invoice_id = incoming.get("id")

    if not invoice_id:
        raise ValueError("Missing invoice ID")

    # Retrieve current invoice from Stripe.
    invoice = stripe_to_dict(
        stripe.Invoice.retrieve(invoice_id)
    )

    if invoice.get("livemode") is not False:
        raise ValueError("Expected Stripe sandbox invoice")

    if invoice.get("status") != "paid":
        return

    remote_id = get_invoice_subscription_id(invoice)

    # Ignore unrelated one-off invoices.
    if not remote_id:
        logger.info(
            "Ignoring non-subscription invoice: %s",
            invoice_id,
        )
        return

    remote = stripe_to_dict(
        stripe.Subscription.retrieve(remote_id)
    )

    metadata = remote.get("metadata") or {}

    try:
        local_id = int(metadata.get("subscription_id"))
    except (ValueError, TypeError):
        logger.warning("Unrecognized Stripe subscription")
        return

    subscription = db.scalar(
        select(UserSubscription)
        .where(UserSubscription.id == local_id)
        .with_for_update()
    )

    if not subscription:
        logger.warning("Unknown local subscription")
        return

    if subscription.status in ("cancelled", "expired"):
        logger.warning(
            "Invoice received for inactive subscription %s",
            subscription.id,
        )
        return

    _, price_id, expected_amount = expected_plan(
        db,
        subscription,
    )

    verified_id, verified_customer = (
        verify_stripe_subscription(
            remote,
            subscription,
            price_id,
        )
    )

    if verified_id != remote_id:
        raise ValueError("Invoice subscription mismatch")

    if (
        stripe_id(invoice.get("customer"))
        != verified_customer
    ):
        raise ValueError("Invoice customer mismatch")

    # Stripe API versions may omit the legacy `paid` boolean.
    # Verify the invoice's paid status and remaining balance instead.
    if (
        invoice.get("status") != "paid"
        or invoice.get("amount_remaining") != 0
        or invoice.get("paid") is False
    ):
        raise ValueError("Invoice is not fully paid")

    expected_minor = int(expected_amount * 100)

    if (
        invoice.get("currency") != "lkr"
        or invoice.get("amount_paid") != expected_minor
        or invoice.get("total") != expected_minor
        or invoice.get("amount_remaining") != 0
    ):
        raise ValueError("Invoice amount mismatch")

    if invoice.get("billing_reason") not in (
        "subscription_create",
        "subscription_cycle",
    ):
        raise ValueError("Unexpected invoice billing reason")

    start, end = invoice_period(invoice, price_id)

    existing_invoice = db.scalar(
        select(SubscriptionPayment).where(
            SubscriptionPayment.stripe_invoice_id
            == invoice_id
        )
    )

    if existing_invoice:
        if existing_invoice.subscription_id != subscription.id:
            raise ValueError("Invoice belongs to another subscription")
        if existing_invoice.payment_status == "paid":
            logger.info("Invoice already paid: %s", invoice_id)
            return
        if existing_invoice.payment_status not in ("pending", "failed"):
            raise ValueError("Unexpected existing payment status")
        payment = existing_invoice
    else:
        payment = None

    if subscription.status == "pending" and payment is None:
        subscription, payment = find_checkout_payment(db, remote)
        if not subscription or not payment:
            raise ValueError("Initial Checkout not yet verified")
        if payment.payment_status != "pending":
            raise ValueError("Initial payment not pending")
    elif payment is None:
        # A new invoice is a renewal payment.
        if invoice.get("billing_reason") != "subscription_cycle":
            raise ValueError("Unexpected invoice for active subscription")
        payment = SubscriptionPayment(
            subscription_id=subscription.id,
            amount=expected_amount,
            currency="LKR",
            payment_status="pending",
        )
        db.add(payment)

    payment.amount = expected_amount
    payment.currency = "LKR"
    payment.payment_status = "paid"
    payment.stripe_invoice_id = invoice_id
    payment.transaction_id = invoice_id
    payment.paid_at = utc_now()

    subscription.stripe_subscription_id = verified_id
    subscription.stripe_customer_id = verified_customer

    # Do not shorten access if an older invoice
    # arrives after a newer renewal.
    if (
        subscription.end_date is None
        or end > subscription.end_date
    ):
        subscription.end_date = end

    if (
        subscription.start_date is None
        or start < subscription.start_date
    ):
        subscription.start_date = start

    subscription.status = "active"

    logger.info(
        "Payment verified: invoice=%s subscription=%s",
        invoice_id,
        subscription.id,
    )


# =====================================
# PAYMENT FAILED
# =====================================

def handle_invoice_failed(event, db):
    incoming = stripe_to_dict(event["data"]["object"])
    invoice_id = incoming.get("id")
    if not invoice_id:
        raise ValueError("Missing failed invoice ID")

    # Fetch Stripe's current state: a delayed failure event must not
    # overwrite an invoice already paid by a successful retry.
    invoice = stripe_to_dict(stripe.Invoice.retrieve(invoice_id))
    if invoice.get("livemode") is not False:
        raise ValueError("Expected Stripe sandbox invoice")
    if invoice.get("status") == "paid":
        logger.info("Ignoring failure for already paid invoice: %s", invoice_id)
        return
    if invoice.get("status") != "open" or not invoice.get("attempted"):
        logger.info("Ignoring invoice without failed payment attempt: %s", invoice_id)
        return

    remote_id = get_invoice_subscription_id(invoice)
    if not remote_id:
        logger.info("Ignoring non-subscription failed invoice: %s", invoice_id)
        return

    remote = stripe_to_dict(stripe.Subscription.retrieve(remote_id))
    metadata = remote.get("metadata") or {}
    try:
        local_id = int(metadata.get("subscription_id"))
    except (ValueError, TypeError):
        logger.warning("Unrecognized Stripe subscription for failed invoice")
        return

    subscription = db.scalar(
        select(UserSubscription)
        .where(UserSubscription.id == local_id)
        .with_for_update()
    )
    if not subscription:
        logger.warning("Unknown local subscription for failed invoice")
        return

    _, price_id, expected_amount = expected_plan(db, subscription)
    verified_id, verified_customer = verify_stripe_subscription(
        remote, subscription, price_id
    )
    if verified_id != remote_id:
        raise ValueError("Failed invoice subscription mismatch")
    if stripe_id(invoice.get("customer")) != verified_customer:
        raise ValueError("Failed invoice customer mismatch")
    if (
        invoice.get("currency") != "lkr"
        or invoice.get("total") != int(expected_amount * 100)
        or invoice.get("amount_remaining") != int(expected_amount * 100)
    ):
        raise ValueError("Failed invoice amount mismatch")
    if invoice.get("billing_reason") != "subscription_cycle":
        # Initial checkout is handled by its existing pending payment.
        logger.info("Ignoring non-renewal failed invoice: %s", invoice_id)
        return
    invoice_period(invoice, price_id)

    payment = db.scalar(
        select(SubscriptionPayment)
        .where(SubscriptionPayment.stripe_invoice_id == invoice_id)
        .with_for_update()
    )
    if payment:
        if payment.subscription_id != subscription.id:
            raise ValueError("Failed invoice belongs to another subscription")
        if payment.payment_status == "paid":
            logger.info("Keeping already paid invoice: %s", invoice_id)
            return
        if payment.payment_status not in ("pending", "failed"):
            raise ValueError("Unexpected payment status for failed invoice")
    else:
        payment = SubscriptionPayment(
            subscription_id=subscription.id,
            stripe_invoice_id=invoice_id,
            amount=expected_amount,
            currency="LKR",
            payment_status="failed",
        )
        db.add(payment)

    payment.amount = expected_amount
    payment.currency = "LKR"
    payment.payment_status = "failed"
    payment.stripe_invoice_id = invoice_id
    payment.paid_at = None
    # Preserve previously paid access; Stripe can retry this invoice.
    logger.warning("Stripe renewal payment failed: invoice=%s subscription=%s", invoice_id, subscription.id)


# =====================================
# SUBSCRIPTION UPDATED
# =====================================

def handle_subscription_updated(event, db):
    remote = stripe_to_dict(event["data"]["object"])
    remote_id = remote.get("id")

    subscription = db.scalar(
        select(UserSubscription).where(
            UserSubscription.stripe_subscription_id
            == remote_id
        )
    )

    if not subscription:
        return

    logger.info(
        "Stripe subscription updated: %s status=%s "
        "cancel_at_period_end=%s",
        remote_id,
        remote.get("status"),
        remote.get("cancel_at_period_end"),
    )

    # Do not activate from subscription.updated.
    # A paid invoice is required for activation.


# =====================================
# SUBSCRIPTION DELETED
# =====================================

def handle_subscription_deleted(event, db):
    remote = stripe_to_dict(event["data"]["object"])

    remote_id = remote.get("id")

    subscription = db.scalar(
        select(UserSubscription)
        .where(
            UserSubscription.stripe_subscription_id
            == remote_id
        )
        .with_for_update()
    )

    if not subscription:
        return

    if (
        subscription.stripe_customer_id
        != stripe_id(remote.get("customer"))
    ):
        raise ValueError("Cancelled customer mismatch")

    subscription.status = "cancelled"

    ended_at = from_timestamp(
        remote.get("ended_at")
    ) or utc_now()

    subscription.end_date = ended_at

    logger.info(
        "Stripe subscription cancelled: %s",
        remote_id,
    )


# =====================================
# WEBHOOK ENDPOINT
# =====================================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()

    signature = request.headers.get(
        "stripe-signature"
    )

    webhook_secret = os.getenv(
        "STRIPE_WEBHOOK_SECRET"
    )

    if not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="Webhook secret not configured",
        )

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Stripe signature",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            webhook_secret,
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload",
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(
            status_code=400,
            detail="Invalid Stripe signature",
        )

    event_id = event["id"]
    event_type = event["type"]

    db = SessionLocal()

    try:
        # Record and process each event atomically.
        existing = db.scalar(
            select(StripeWebhookEvent).where(
                StripeWebhookEvent.stripe_event_id
                == event_id
            )
        )

        if existing:
            return {
                "received": True,
                "duplicate": True,
            }

        if event_type == "checkout.session.completed":
            handle_checkout_completed(event, db)

        elif event_type == "invoice.paid":
            handle_invoice_paid(event, db)

        elif event_type == "invoice.payment_failed":
            handle_invoice_failed(event, db)

        elif event_type == "customer.subscription.updated":
            handle_subscription_updated(event, db)

        elif event_type == "customer.subscription.deleted":
            handle_subscription_deleted(event, db)

        else:
            logger.info(
                "Unhandled Stripe event: %s",
                event_type,
            )

        db.add(
            StripeWebhookEvent(
                stripe_event_id=event_id,
                event_type=event_type,
            )
        )

        db.commit()

        return {
            "received": True,
            "event_type": event_type,
        }

    except Exception:
        db.rollback()

        logger.exception(
            "Stripe webhook processing failed"
        )
        

        raise HTTPException(
            status_code=500,
            detail="Webhook processing failed",
        )

    finally:
        db.close()