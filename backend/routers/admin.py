
from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.order import Order
from models.subscription import SubscriptionPlan, UserSubscription
from routers.auth import get_current_user
from schemas.user import UserResponse
from services.notification_service import create_notification
from services.shop_subscription_service import (
    utc_now,
    get_valid_shop_subscription,
)


# ========================================
# ADMIN ROUTER
# ========================================

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


# ========================================
# ADMIN ROLE PROTECTION
# ========================================

def require_admin(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


# ========================================
# ORDER RESPONSE HELPER
# ========================================

def serialize_order(order: Order):
    return {
        "order_id": order.id,
        "customer_id": order.customer_id,
        "shop_id": order.shop_id,
        "grocery_basket_id": order.grocery_basket_id,
        "status": order.status,
        "estimated_total_lkr": float(
            order.estimated_total_lkr
        ),
        "created_at": order.created_at,
    }


# ========================================
# SUBSCRIPTION HELPERS
# ========================================

def get_shop_subscription_details(
    db: Session,
    shop_owner_id: int,
):
    """
    Get the latest relevant shop-owner subscription.

    Prefer a currently valid subscription.
    Otherwise show the most recent subscription.

    This function does not automatically reject shops.
    """

    now = utc_now()

    valid_subscription = get_valid_shop_subscription(
        db,
        shop_owner_id,
    )

    subscription = valid_subscription

    if subscription is None:
        subscription = db.scalar(
            select(UserSubscription)
            .join(
                SubscriptionPlan,
                UserSubscription.plan_id
                == SubscriptionPlan.id,
            )
            .where(
                UserSubscription.user_id
                == shop_owner_id,
                SubscriptionPlan.user_role
                == "shop_owner",
            )
            .order_by(
                UserSubscription.created_at.desc(),
                UserSubscription.id.desc(),
            )
            .limit(1)
        )

    if subscription is None:
        return None

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if plan is None:
        return None

    is_valid = (
        subscription.status == "active"
        and subscription.start_date is not None
        and subscription.start_date <= now
        and subscription.end_date is not None
        and subscription.end_date > now
    )

    is_trial = (
        plan.price == Decimal("0.00")
        and "trial" in plan.name.lower()
    )

    if is_valid:
        display_status = (
            "trial" if is_trial else "active"
        )
    else:
        display_status = "overdue"

    days_remaining = 0

    if is_valid:
        days_remaining = max(
            0,
            (
                subscription.end_date - now
            ).days
            + (
                1
                if (
                    subscription.end_date - now
                ).seconds > 0
                else 0
            ),
        )

    return {
        "id": subscription.id,
        "subscription_id": subscription.id,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "status": (
            "active"
            if is_valid
            else subscription.status
        ),
        "display_status": display_status,
        "is_trial": is_trial,
        "is_valid": is_valid,
        "start_date": subscription.start_date,
        "end_date": subscription.end_date,
        "days_remaining": days_remaining,
        "price_lkr": float(plan.price),
        "duration_days": plan.duration_days,
        "stripe_subscription_id":
            subscription.stripe_subscription_id,
    }


def serialize_shop_owner(
    db: Session,
    shop_owner: User,
):
    """
    Preserve existing UserResponse fields and
    append subscription information for Admin UI.
    """

    user_data = UserResponse.model_validate(
        shop_owner
    ).model_dump(mode="json")

    subscription = get_shop_subscription_details(
        db,
        shop_owner.id,
    )

    user_data["subscription"] = subscription

    user_data["subscription_status"] = (
        subscription["display_status"]
        if subscription
        else "none"
    )

    user_data["subscription_plan_name"] = (
        subscription["plan_name"]
        if subscription
        else None
    )

    user_data["subscription_start_date"] = (
        subscription["start_date"].isoformat()
        if subscription
        and subscription["start_date"]
        else None
    )

    user_data["subscription_end_date"] = (
        subscription["end_date"].isoformat()
        if subscription
        and subscription["end_date"]
        else None
    )

    user_data["subscription_days_remaining"] = (
        subscription["days_remaining"]
        if subscription
        else 0
    )

    return user_data


# ========================================
# ADMIN DASHBOARD USER STATISTICS
# ========================================

@router.get("/dashboard/stats")
def get_admin_dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    def count_users(*conditions):
        return db.scalar(
            select(func.count(User.id)).where(
                *conditions
            )
        ) or 0

    total_users = count_users()

    total_customers = count_users(
        User.role == "customer"
    )

    active_customers = count_users(
        User.role == "customer",
        User.is_active.is_(True),
    )

    inactive_customers = count_users(
        User.role == "customer",
        User.is_active.is_(False),
    )

    total_shop_owners = count_users(
        User.role == "shop_owner"
    )

    pending_shop_owners = count_users(
        User.role == "shop_owner",
        User.approval_status == "pending",
    )

    approved_shop_owners = count_users(
        User.role == "shop_owner",
        User.approval_status == "approved",
    )

    rejected_shop_owners = count_users(
        User.role == "shop_owner",
        User.approval_status == "rejected",
    )

    return {
        "total_users": total_users,
        "total_customers": total_customers,
        "active_customers": active_customers,
        "inactive_customers": inactive_customers,
        "total_shop_owners": total_shop_owners,
        "pending_shop_owners": pending_shop_owners,
        "approved_shop_owners": approved_shop_owners,
        "rejected_shop_owners": rejected_shop_owners,
    }


# ========================================
# ADMIN DASHBOARD ORDER STATISTICS
# ========================================

@router.get("/dashboard/orders")
def get_admin_order_statistics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    total_orders = db.scalar(
        select(func.count(Order.id))
    ) or 0

    status_counts = db.execute(
        select(
            Order.status,
            func.count(Order.id),
        ).group_by(Order.status)
    ).all()

    orders_by_status = {
        order_status: count
        for order_status, count in status_counts
    }

    total_estimated_value = db.scalar(
        select(
            func.sum(Order.estimated_total_lkr)
        )
    ) or 0

    return {
        "total_orders": total_orders,
        "orders_by_status": orders_by_status,
        "total_estimated_order_value_lkr": float(
            total_estimated_value
        ),
    }


# ========================================
# ADMIN DASHBOARD RECENT ORDERS
# ========================================

@router.get("/dashboard/recent-orders")
def get_admin_recent_orders(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    orders = db.scalars(
        select(Order)
        .order_by(
            Order.created_at.desc(),
            Order.id.desc(),
        )
        .limit(10)
    ).all()

    return [
        serialize_order(order)
        for order in orders
    ]


# ========================================
# GET ALL ORDERS
# ========================================

@router.get("/orders")
def get_all_orders(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    orders = db.scalars(
        select(Order)
        .order_by(
            Order.created_at.desc(),
            Order.id.desc(),
        )
    ).all()

    return [
        serialize_order(order)
        for order in orders
    ]


# ========================================
# GET SINGLE ORDER DETAILS
# ========================================

@router.get("/orders/{order_id}")
def get_admin_order_details(
    order_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    order = db.get(Order, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    customer = db.get(
        User,
        order.customer_id,
    )

    shop_owner = db.get(
        User,
        order.shop_id,
    )

    return {
        **serialize_order(order),
        "customer": {
            "id": customer.id,
            "full_name": customer.full_name,
            "email": customer.email,
        } if customer else None,
        "shop": {
            "id": shop_owner.id,
            "shop_name": shop_owner.shop_name,
            "email": shop_owner.email,
            "phone": shop_owner.phone,
            "address": shop_owner.address,
        } if shop_owner else None,
        "basket_snapshot": order.basket_snapshot,
    }


# ========================================
# GET ALL SHOP OWNERS WITH SUBSCRIPTIONS
# ========================================

@router.get("/shop-owners")
def get_all_shop_owners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    shop_owners = db.scalars(
        select(User)
        .where(
            User.role == "shop_owner"
        )
        .order_by(User.id.desc())
    ).all()

    return [
        serialize_shop_owner(db, shop_owner)
        for shop_owner in shop_owners
    ]


# ========================================
# GET PENDING SHOP OWNERS
# ========================================

@router.get("/shop-owners/pending")
def get_pending_shop_owners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    shop_owners = db.scalars(
        select(User)
        .where(
            User.role == "shop_owner",
            User.approval_status == "pending",
        )
        .order_by(User.id)
    ).all()

    return [
        serialize_shop_owner(db, shop_owner)
        for shop_owner in shop_owners
    ]


# ========================================
# APPROVE SHOP OWNER
# ========================================

@router.patch(
    "/shop-owners/{shop_owner_id}/approve",
    response_model=UserResponse,
)
def approve_shop_owner(
    shop_owner_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    shop_owner = db.scalar(
        select(User)
        .where(
            User.id == shop_owner_id,
            User.role == "shop_owner",
        )
        .with_for_update()
    )

    if shop_owner is None:
        raise HTTPException(
            status_code=404,
            detail="Shop owner not found",
        )

    if shop_owner.approval_status != "pending":
        raise HTTPException(
            status_code=409,
            detail=(
                "Only pending shop owners "
                "can be approved"
            ),
        )

    trial_plan = db.scalar(
        select(SubscriptionPlan).where(
            SubscriptionPlan.name
            == "Shop Owner Free Trial",
            SubscriptionPlan.user_role
            == "shop_owner",
            SubscriptionPlan.price
            == Decimal("0.00"),
            SubscriptionPlan.duration_days == 30,
        )
    )

    if trial_plan is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Shop Owner Free Trial plan "
                "(30 days) is not configured"
            ),
        )

    existing_trial = db.scalar(
        select(UserSubscription.id)
        .join(
            SubscriptionPlan,
            UserSubscription.plan_id
            == SubscriptionPlan.id,
        )
        .where(
            UserSubscription.user_id
            == shop_owner.id,
            SubscriptionPlan.user_role
            == "shop_owner",
            SubscriptionPlan.price
            == Decimal("0.00"),
        )
        .limit(1)
    )

    if existing_trial is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This shop owner has already "
                "received a free trial"
            ),
        )

    trial_start = utc_now()

    db.add(
        UserSubscription(
            user_id=shop_owner.id,
            plan_id=trial_plan.id,
            status="active",
            start_date=trial_start,
            end_date=(
                trial_start
                + timedelta(days=30)
            ),
        )
    )

    shop_owner.approval_status = "approved"

    try:
        create_notification(
            db=db,
            user_id=shop_owner.id,
            title="Shop Registration Approved",
            message=(
                "Your partner shop registration "
                "has been approved. Your 30-day "
                "free trial has started."
            ),
        )

        db.commit()
        db.refresh(shop_owner)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not approve shop owner "
                "and start free trial"
            ),
        )

    return shop_owner


# ========================================
# REJECT SHOP OWNER
# ========================================

@router.patch(
    "/shop-owners/{shop_owner_id}/reject",
    response_model=UserResponse,
)
def reject_shop_owner(
    shop_owner_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    shop_owner = db.scalar(
        select(User)
        .where(
            User.id == shop_owner_id,
            User.role == "shop_owner",
        )
        .with_for_update()
    )

    if shop_owner is None:
        raise HTTPException(
            status_code=404,
            detail="Shop owner not found",
        )

    if shop_owner.approval_status not in (
        "pending",
        "approved",
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Only pending or approved "
                "shop owners can be rejected"
            ),
        )

    if shop_owner.approval_status == "approved":
        valid_subscription = (
            get_valid_shop_subscription(
                db,
                shop_owner.id,
            )
        )

        if valid_subscription is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Shop owner has a valid "
                    "subscription; not overdue"
                ),
            )

    was_pending = (
        shop_owner.approval_status == "pending"
    )

    shop_owner.approval_status = "rejected"

    try:
        create_notification(
            db=db,
            user_id=shop_owner.id,
            title=(
                "Shop Registration Rejected"
                if was_pending
                else "Shop Access Rejected"
            ),
            message=(
                "Your partner shop registration "
                "has not been approved."
                if was_pending
                else (
                    "Your partner shop access has "
                    "been rejected by the admin "
                    "because there is no valid "
                    "subscription."
                )
            ),
        )

        db.commit()
        db.refresh(shop_owner)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not reject shop owner",
        )

    return shop_owner


# ========================================
# GET ALL CUSTOMERS
# ========================================

@router.get(
    "/customers",
    response_model=list[UserResponse],
)
def get_all_customers(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    return db.scalars(
        select(User)
        .where(
            User.role == "customer"
        )
        .order_by(User.id.desc())
    ).all()


# ========================================
# GET SINGLE CUSTOMER
# ========================================

@router.get(
    "/customers/{customer_id}",
    response_model=UserResponse,
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    customer = db.get(
        User,
        customer_id,
    )

    if (
        customer is None
        or customer.role != "customer"
    ):
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    return customer


# ========================================
# ACTIVATE CUSTOMER
# ========================================

@router.patch(
    "/customers/{customer_id}/activate",
    response_model=UserResponse,
)
def activate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    customer = db.get(
        User,
        customer_id,
    )

    if (
        customer is None
        or customer.role != "customer"
    ):
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    if customer.is_active:
        raise HTTPException(
            status_code=409,
            detail=(
                "Customer account is "
                "already active"
            ),
        )

    customer.is_active = True

    db.commit()
    db.refresh(customer)

    return customer


# ========================================
# DEACTIVATE CUSTOMER
# ========================================

@router.patch(
    "/customers/{customer_id}/deactivate",
    response_model=UserResponse,
)
def deactivate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):

    customer = db.get(
        User,
        customer_id,
    )

    if (
        customer is None
        or customer.role != "customer"
    ):
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=409,
            detail=(
                "Customer account is "
                "already inactive"
            ),
        )

    customer.is_active = False

    db.commit()
    db.refresh(customer)

    return customer
