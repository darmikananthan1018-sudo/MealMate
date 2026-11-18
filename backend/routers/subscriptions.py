
import os
from datetime import datetime, timedelta, timezone
from calendar import monthrange

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.subscription import (
    SubscriptionPlan,
    UserSubscription,
    SubscriptionPayment,
)
from routers.auth import get_current_user
from schemas.subscription import (
    SubscriptionPlanResponse,
    UserSubscriptionResponse,
    SubscriptionCheckoutRequest,
    SubscriptionPaymentResponse,
)


# =====================================
# ENVIRONMENT CONFIGURATION
# =====================================

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"],
)


# =====================================
# DATE HELPERS
# =====================================

def utc_now():
    # Database stores naive UTC datetime values.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def add_calendar_month(start_date):
    month_index = start_date.month
    year = start_date.year + month_index // 12
    month = month_index % 12 + 1

    day = min(
        start_date.day,
        monthrange(year, month)[1],
    )

    return start_date.replace(
        year=year,
        month=month,
        day=day,
    )


# =====================================
# CHECK SUBSCRIPTION EXPIRY
# =====================================

def refresh_expired_subscriptions(db, user_id):
    now = utc_now()

    subscriptions = db.scalars(
        select(UserSubscription).where(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.end_date.is_not(None),
            UserSubscription.end_date <= now,
        )
    ).all()

    if subscriptions:
        for subscription in subscriptions:
            subscription.status = "expired"

        db.commit()


# =====================================
# GET AVAILABLE PLANS
# =====================================

@router.get(
    "/plans",
    response_model=list[SubscriptionPlanResponse],
)
def get_subscription_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("customer", "shop_owner"):
        raise HTTPException(
            status_code=403,
            detail="Subscription plans are not available for this role",
        )

    return db.scalars(
        select(SubscriptionPlan).where(
            SubscriptionPlan.user_role == current_user.role
        )
    ).all()


# =====================================
# GET MY SUBSCRIPTIONS
# =====================================

@router.get(
    "/me",
    response_model=list[UserSubscriptionResponse],
)
def get_my_subscriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    refresh_expired_subscriptions(
        db,
        current_user.id,
    )

    return db.scalars(
        select(UserSubscription)
        .where(
            UserSubscription.user_id == current_user.id
        )
        .order_by(UserSubscription.id.desc())
    ).all()


# =====================================
# ACTIVATE CUSTOMER FREE TRIAL
# =====================================

@router.post(
    "/trial",
    response_model=UserSubscriptionResponse,
    status_code=201,
)
def activate_free_trial(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Free trial is only available for customers",
        )

    trial_plan = db.scalar(
        select(SubscriptionPlan).where(
            SubscriptionPlan.name == "Customer Free Trial",
            SubscriptionPlan.user_role == "customer",
            SubscriptionPlan.price == 0,
        )
    )

    if not trial_plan:
        raise HTTPException(
            status_code=404,
            detail="Customer free trial plan not found",
        )

    existing_trial = db.scalar(
        select(UserSubscription).where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.plan_id == trial_plan.id,
        )
    )

    if existing_trial:
        raise HTTPException(
            status_code=409,
            detail="Free trial has already been used",
        )

    refresh_expired_subscriptions(
        db,
        current_user.id,
    )

    existing_active = db.scalar(
        select(UserSubscription).where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == "active",
        )
    )

    if existing_active:
        raise HTTPException(
            status_code=409,
            detail="You already have an active subscription",
        )

    now = utc_now()

    subscription = UserSubscription(
        user_id=current_user.id,
        plan_id=trial_plan.id,
        status="active",
        start_date=now,
        end_date=now + timedelta(days=21),
    )

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    return subscription


# =====================================
# CREATE PAID SUBSCRIPTION CHECKOUT
# =====================================

@router.post(
    "/checkout",
    response_model=SubscriptionPaymentResponse,
    status_code=201,
)
def create_subscription_checkout(
    data: SubscriptionCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Serialize checkout creation for this user.
    # MySQL/InnoDB row lock protects concurrent requests.
    db.scalar(
        select(User.id)
        .where(User.id == current_user.id)
        .with_for_update()
    )

    plan = db.get(
        SubscriptionPlan,
        data.plan_id,
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Subscription plan not found",
        )

    if plan.user_role != current_user.role:
        raise HTTPException(
            status_code=403,
            detail="This plan is not available for your role",
        )

    if plan.price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Use the free trial endpoint for free plans",
        )

    refresh_expired_subscriptions(
        db,
        current_user.id,
    )

    # Prevent another active paid subscription.
    existing_paid = db.scalar(
        select(UserSubscription)
        .join(
            SubscriptionPlan,
            UserSubscription.plan_id == SubscriptionPlan.id,
        )
        .where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == "active",
            SubscriptionPlan.price > 0,
        )
    )

    if existing_paid:
        raise HTTPException(
            status_code=409,
            detail="You already have an active paid subscription",
        )

    # Reuse an existing pending checkout.
    pending_subscription = db.scalar(
        select(UserSubscription)
        .join(
            SubscriptionPlan,
            UserSubscription.plan_id == SubscriptionPlan.id,
        )
        .where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == "pending",
            SubscriptionPlan.price > 0,
        )
        .order_by(UserSubscription.id.desc())
    )

    if pending_subscription:
        if pending_subscription.plan_id != plan.id:
            raise HTTPException(
                status_code=409,
                detail="Another subscription checkout is already pending",
            )

        existing_payment = db.scalar(
            select(SubscriptionPayment)
            .where(
                SubscriptionPayment.subscription_id
                == pending_subscription.id,
                SubscriptionPayment.payment_status == "pending",
            )
            .order_by(SubscriptionPayment.id.desc())
        )

        if existing_payment:
            db.commit()
            return existing_payment

        raise HTTPException(
            status_code=409,
            detail="Pending subscription requires reconciliation",
        )

    # Create pending subscription only.
    subscription = UserSubscription(
        user_id=current_user.id,
        plan_id=plan.id,
        status="pending",
    )

    db.add(subscription)
    db.flush()

    payment = SubscriptionPayment(
        subscription_id=subscription.id,
        amount=plan.price,
        currency="LKR",
        payment_status="pending",
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return payment


# =====================================
# CANCEL SUBSCRIPTION
# =====================================

@router.post(
    "/cancel",
    response_model=UserSubscriptionResponse,
)
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    refresh_expired_subscriptions(
        db,
        current_user.id,
    )

    subscription = db.scalar(
        select(UserSubscription)
        .where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == "active",
        )
        .order_by(UserSubscription.id.desc())
    )

    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="No active subscription found",
        )

    # =====================================
    # STRIPE PAID SUBSCRIPTION
    # =====================================

    if subscription.stripe_subscription_id:
        try:
            stripe_subscription = stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=True,
            )

        except stripe.StripeError:
            raise HTTPException(
                status_code=502,
                detail="Unable to schedule Stripe cancellation",
            )

        if not stripe_subscription.cancel_at_period_end:
            raise HTTPException(
                status_code=502,
                detail="Stripe did not confirm cancellation scheduling",
            )

        # Stripe has scheduled cancellation.
        # Keep local status active until the paid
        # period ends. The webhook must synchronize
        # the final cancellation.
        db.refresh(subscription)
        return subscription

    # =====================================
    # LOCAL FREE TRIAL
    # =====================================

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if not plan or plan.price != 0:
        raise HTTPException(
            status_code=409,
            detail="Paid subscription is missing its Stripe reference",
        )

    subscription.status = "cancelled"
    subscription.end_date = utc_now()

    db.commit()
    db.refresh(subscription)

    return subscription
