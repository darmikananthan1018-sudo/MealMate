import os
import stripe

from dotenv import load_dotenv
from sqlalchemy import select

from database import SessionLocal
from models.user import User

from models.subscription import (
    UserSubscription,
    SubscriptionPayment,
    StripeWebhookEvent,
)

from routers.stripe_webhook import (
    handle_checkout_completed,
    handle_invoice_paid,
)

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

CHECKOUT_EVENT_ID = "evt_1Ud5fRJixp6vneWe6zmSAYFm"
INVOICE_EVENT_ID = "evt_1Ud5fQJixp6vneWerizvMhKf"

EXPECTED_SESSION_ID = (
    "cs_test_a03APksd0IfDZ7L6tLBKsUkAAx0rh5jUDNXWQZU4vC3TLZLFGRwoLbacd3"
)

EXPECTED_INVOICE_ID = (
    "in_1Ud5fOJixp6vneWekr6lJRpJ"
)


def process_event(
    event_id,
    expected_type,
    expected_object_id,
    handler,
):
    event = stripe.Event.retrieve(event_id).to_dict()

    if event["livemode"] is not False:
        raise ValueError("Only sandbox events are allowed")

    if event["type"] != expected_type:
        raise ValueError("Unexpected event type")

    if event["data"]["object"]["id"] != expected_object_id:
        raise ValueError("Unexpected Stripe object")

    db = SessionLocal()

    try:
        existing = db.scalar(
            select(StripeWebhookEvent).where(
                StripeWebhookEvent.stripe_event_id == event_id
            )
        )

        if existing:
            print("Already processed:", event_id)
            return

        handler(event, db)

        db.add(
            StripeWebhookEvent(
                stripe_event_id=event_id,
                event_type=expected_type,
            )
        )

        db.commit()

        print("Processed:", event_id)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":

    if (
        not stripe.api_key
        or not stripe.api_key.startswith("sk_test_")
    ):
        raise RuntimeError(
            "Sandbox Stripe API key required"
        )

    process_event(
        CHECKOUT_EVENT_ID,
        "checkout.session.completed",
        EXPECTED_SESSION_ID,
        handle_checkout_completed,
    )

    process_event(
        INVOICE_EVENT_ID,
        "invoice.paid",
        EXPECTED_INVOICE_ID,
        handle_invoice_paid,
    )

    print("Recovery completed")
