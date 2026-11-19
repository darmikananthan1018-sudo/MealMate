
import os
import uuid
from decimal import Decimal

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.subscription import (
    SubscriptionPlan,
    UserSubscription,
    SubscriptionPayment,
)
from routers.auth import get_current_user


load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(
    prefix="/subscriptions/stripe",
    tags=["Stripe Payments"],
)


PRICE_CONFIG = {
    ("customer", "Customer Premium"): (
        "STRIPE_CUSTOMER_PREMIUM_PRICE_ID",
        Decimal("799.00"),
    ),
   ("shop_owner", "Shop Owner Business"): (
    "STRIPE_SHOP_OWNER_BUSINESS_PRICE_ID",
    Decimal("7000.00"),
),
}


@router.post("/checkout/{payment_id}")
def create_stripe_checkout(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Find payment
    payment = db.get(SubscriptionPayment, payment_id)

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    # 2. Verify subscription ownership
    subscription = db.get(
        UserSubscription,
        payment.subscription_id,
    )

    if (
        not subscription
        or subscription.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    # 3. Validate pending status
    if (
        payment.payment_status != "pending"
        or subscription.status != "pending"
    ):
        raise HTTPException(
            status_code=409,
            detail="Payment is not pending",
        )

    # 4. Validate plan
    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if (
        not plan
        or plan.user_role != current_user.role
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid subscription plan",
        )

    config = PRICE_CONFIG.get(
        (plan.user_role, plan.name)
    )

    if not config:
        raise HTTPException(
            status_code=400,
            detail="Unsupported paid plan",
        )

    price_env_name, expected_amount = config
    price_id = os.getenv(price_env_name)

    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Stripe Price ID is missing",
        )

    if (
        payment.amount != expected_amount
        or plan.price != expected_amount
        or payment.currency.upper() != "LKR"
    ):
        raise HTTPException(
            status_code=409,
            detail="Payment amount or currency mismatch",
        )

    # 5. Check existing Checkout Session
    if payment.stripe_checkout_session_id:
        try:
            existing_session = stripe.checkout.Session.retrieve(
                payment.stripe_checkout_session_id
            )

            if existing_session.status == "open":
                if existing_session.url:
                    return {
                        "message": "Existing checkout session",
                        "payment_id": payment.id,
                        "subscription_id": subscription.id,
                        "checkout_url": existing_session.url,
                        "session_id": existing_session.id,
                        "payment_status": "pending",
                    }

                raise HTTPException(
                    status_code=409,
                    detail="Existing Checkout Session has no URL",
                )

            if existing_session.status == "complete":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Checkout completed; "
                        "awaiting payment verification"
                    ),
                )

            # Expired sessions can be replaced.

        except stripe.StripeError:
            raise HTTPException(
                status_code=502,
                detail="Unable to verify existing Stripe session",
            )

    # 6. Verify Stripe Price
    try:
        stripe_price = stripe.Price.retrieve(price_id)

        if (
            stripe_price.currency.lower() != "lkr"
            or stripe_price.type != "recurring"
            or stripe_price.recurring.interval != "month"
            or stripe_price.unit_amount is None
            or Decimal(str(stripe_price.unit_amount))
            != expected_amount * 100
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe Price configuration mismatch",
            )

        # 7. Sandbox-only Test Clock Customer
        test_customer_id = None

        if (
            os.getenv("MEALMATE_RENEWAL_TEST_MODE") == "true"
            and current_user.id == 35
            and os.getenv(
                "STRIPE_SECRET_KEY", ""
            ).startswith("sk_test_")
        ):
            test_customer_id = os.getenv(
                "MEALMATE_RENEWAL_TEST_CUSTOMER_ID"
            )

            if not test_customer_id:
                raise HTTPException(
                    status_code=503,
                    detail="Renewal test customer is not configured",
                )

            test_customer = stripe.Customer.retrieve(
                test_customer_id
            )

            # Stripe Customer object -> Python dictionary
            test_customer = test_customer.to_dict()

            if (
                test_customer.get("deleted")
                or test_customer.get("livemode")
                or test_customer.get("email")
                != current_user.email
                or test_customer.get("test_clock")
                != "clock_1Ud1vsJixp6vneWeKCNZlqla"
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Invalid renewal test customer",
                )

        # 8. Create Checkout Session
        customer_params = (
            {"customer": test_customer_id}
            if test_customer_id
            else {"customer_email": current_user.email}
        )

        checkout_session = stripe.checkout.Session.create(
            mode="subscription",
            **customer_params,
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            client_reference_id=str(subscription.id),
            metadata={
                "payment_id": str(payment.id),
                "subscription_id": str(subscription.id),
                "user_id": str(current_user.id),
            },
            subscription_data={
                "metadata": {
                    "subscription_id": str(subscription.id),
                    "user_id": str(current_user.id),
                }
            },
            success_url=os.getenv(
                "STRIPE_SUCCESS_URL",
                "http://localhost:5173/payment/success",
            ) + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=os.getenv(
                "STRIPE_CANCEL_URL",
                "http://localhost:5173/payment/cancel",
            ),
           idempotency_key=f"mealmate-checkout-{payment.id}",
        )

    except stripe.StripeError:
        raise HTTPException(
            status_code=502,
            detail="Stripe checkout request failed",
        )

    # 9. Save Checkout Session
    payment.stripe_checkout_session_id = checkout_session.id

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save checkout session",
        )

    return {
        "message": "Stripe checkout session created",
        "payment_id": payment.id,
        "subscription_id": subscription.id,
        "checkout_url": checkout_session.url,
        "session_id": checkout_session.id,
        "payment_status": "pending",
    }
