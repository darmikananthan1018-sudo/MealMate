from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.order import Order
from routers.auth import get_current_user
from schemas.user import UserResponse
from services.notification_service import create_notification


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
# HELPER: ORDER RESPONSE
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
# GET ALL SHOP OWNERS
# ========================================

@router.get(
    "/shop-owners",
    response_model=list[UserResponse],
)
def get_all_shop_owners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.scalars(
        select(User)
        .where(User.role == "shop_owner")
        .order_by(User.id.desc())
    ).all()


# ========================================
# GET PENDING SHOP OWNERS
# ========================================

@router.get(
    "/shop-owners/pending",
    response_model=list[UserResponse],
)
def get_pending_shop_owners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.scalars(
        select(User)
        .where(
            User.role == "shop_owner",
            User.approval_status == "pending",
        )
        .order_by(User.id)
    ).all()


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
    shop_owner = db.get(
        User,
        shop_owner_id,
    )

    if (
        shop_owner is None
        or shop_owner.role != "shop_owner"
    ):
        raise HTTPException(
            status_code=404,
            detail="Shop owner not found",
        )

    if shop_owner.approval_status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Only pending shop owners can be approved",
        )

    shop_owner.approval_status = "approved"

    create_notification(
        db=db,
        user_id=shop_owner.id,
        title="Shop Registration Approved",
        message="Your partner shop registration has been approved.",
    )

    db.commit()
    db.refresh(shop_owner)

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
    shop_owner = db.get(
        User,
        shop_owner_id,
    )

    if (
        shop_owner is None
        or shop_owner.role != "shop_owner"
    ):
        raise HTTPException(
            status_code=404,
            detail="Shop owner not found",
        )

    if shop_owner.approval_status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Only pending shop owners can be rejected",
        )

    shop_owner.approval_status = "rejected"

    create_notification(
        db=db,
        user_id=shop_owner.id,
        title="Shop Registration Rejected",
        message="Your partner shop registration has not been approved.",
    )

    db.commit()
    db.refresh(shop_owner)

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
        .where(User.role == "customer")
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
            detail="Customer account is already active",
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
            detail="Customer account is already inactive",
        )

    customer.is_active = False

    db.commit()
    db.refresh(customer)

    return customer
