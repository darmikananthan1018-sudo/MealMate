
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from database import Base


# =====================================
# SUBSCRIPTION PLANS
# =====================================

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    user_role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    duration_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )


# =====================================
# USER SUBSCRIPTIONS
# =====================================

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    plan_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_plans.id"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )

    start_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    end_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # =====================================
    # STRIPE SUBSCRIPTION DETAILS
    # =====================================

    # Stripe recurring subscription ID
    # Example: sub_...
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    # Stripe customer ID
    # Example: cus_...
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


# =====================================
# SUBSCRIPTION PAYMENTS
# =====================================

class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("user_subscriptions.id"),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="LKR",
    )

    payment_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )

    transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    # =====================================
    # STRIPE PAYMENT DETAILS
    # =====================================

    # Stripe invoice ID
    # Example: in_...
    stripe_invoice_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    # Stripe Checkout Session ID
    # Example: cs_test_...
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    
# =====================================
# STRIPE WEBHOOK EVENTS
# =====================================

class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    stripe_event_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    processed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
