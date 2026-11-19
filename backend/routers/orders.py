from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.grocery_basket import GroceryBasket
from models.order import Order
from models.order_item import OrderItem
from models.notification import Notification
from routers.auth import get_current_user
from services.notification_service import notify_all_admins
from services.shop_subscription_service import is_shop_eligible


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


# ========================================
# REQUEST SCHEMAS
# ========================================

class CreateOrderRequest(BaseModel):
    grocery_basket_id: int = Field(gt=0)
    shop_id: int = Field(gt=0)


class UpdateOrderStatusRequest(BaseModel):
    status: str


class UpdateItemAvailabilityRequest(BaseModel):
    availability_status: str


# ========================================
# HELPER FUNCTIONS
# ========================================

def serialize_order(
    order,
    db,
    include_customer_details=False,
):
    shop = db.get(User, order.shop_id)

    result = {
        "id": order.id,
        "customer_id": order.customer_id,
        "shop_id": order.shop_id,
        "shop_name": shop.shop_name if shop else None,
        "grocery_basket_id": order.grocery_basket_id,
        "basket_snapshot": order.basket_snapshot,
        "estimated_total_lkr": float(
            order.estimated_total_lkr
        ),
        "status": order.status,
        "created_at": (
            order.created_at.isoformat()
            if order.created_at
            else None
        ),
    }

    if include_customer_details:
        customer = db.get(User, order.customer_id)

        result["customer_name"] = (
            customer.full_name if customer else None
        )

        result["customer_phone"] = (
            customer.phone if customer else None
        )

        result["customer_address"] = (
            customer.address if customer else None
        )

    return result


def serialize_order_item(item):
    return {
        "id": item.id,
        "order_id": item.order_id,
        "item_index": item.item_index,
        "name": item.item_name,
        "quantity": float(item.quantity),
        "unit": item.unit,
        "availability_status": item.availability_status,
        "updated_at": (
            item.updated_at.isoformat()
            if item.updated_at
            else None
        ),
    }


def require_customer(current_user):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Only customers can perform this action.",
        )


def require_shop_owner(current_user):
    if current_user.role != "shop_owner":
        raise HTTPException(
            status_code=403,
            detail="Only shop owners can perform this action.",
        )


def get_accessible_order(order_id, db, current_user):
    order = db.get(Order, order_id)

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    if (
        current_user.id != order.customer_id
        and current_user.id != order.shop_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot access this order.",
        )

    return order


def get_shop_order(order_id, db, current_user):
    require_shop_owner(current_user)

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.shop_id == current_user.id,
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    return order


def create_order_items(order, db):
    """
    Create order item records from the
    original grocery basket snapshot.
    """

    snapshot = order.basket_snapshot

    if not isinstance(snapshot, dict):
        raise ValueError("Invalid basket snapshot.")

    items = snapshot.get("items")

    if not isinstance(items, list) or not items:
        raise ValueError(
            "Grocery basket must contain items."
        )

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(
                "Invalid grocery basket item."
            )

        name = item.get("name")
        unit = item.get("unit")

        if (
            not isinstance(name, str)
            or not name.strip()
            or len(name) > 150
            or not isinstance(unit, str)
            or not unit.strip()
            or len(unit) > 30
        ):
            raise ValueError(
                "Invalid grocery item name or unit."
            )

        try:
            quantity = Decimal(
                str(item.get("quantity"))
            )
        except (InvalidOperation, ValueError, TypeError):
            raise ValueError(
                "Invalid grocery item quantity."
            )

        if (
            not quantity.is_finite()
            or quantity <= 0
            or quantity >= Decimal("1000000000")
        ):
            raise ValueError(
                "Invalid grocery item quantity."
            )

        db.add(
            OrderItem(
                order_id=order.id,
                item_index=index,
                item_name=name.strip(),
                quantity=quantity,
                unit=unit.strip(),
                availability_status="pending",
            )
        )


def create_customer_notification(
    db,
    customer_id,
    order_id,
    title,
    message,
):
    notification = Notification(
        user_id=customer_id,
        order_id=order_id,
        title=title,
        message=message,
        is_read=False,
    )

    db.add(notification)


def create_shop_owner_notification(
    db,
    shop_owner_id,
    order_id,
    title,
    message,
):
    notification = Notification(
        user_id=shop_owner_id,
        order_id=order_id,
        title=title,
        message=message,
        is_read=False,
    )

    db.add(notification)
    print(
        f"[ORDER DEBUG] Shop notification queued: "
        f"shop_owner_id={shop_owner_id}, order_id={order_id}",
        flush=True,
    )


# ========================================
# 1. CUSTOMER SENDS BASKET TO SHOP
# ========================================

@router.post("", status_code=201)
def create_order(
    payload: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    basket = (
        db.query(GroceryBasket)
        .filter(
            GroceryBasket.id == payload.grocery_basket_id,
            GroceryBasket.user_id == current_user.id,
        )
        .first()
    )

    if not basket:
        raise HTTPException(
            status_code=404,
            detail="Grocery basket not found.",
        )

    shop = (
        db.query(User)
        .filter(
            User.id == payload.shop_id,
            User.role == "shop_owner",
            User.is_active.is_(True),
            User.approval_status == "approved",
        )
        .first()
    )

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Approved partner shop not found.",
        )

    # Block new baskets when the shop has no valid trial or paid subscription.
    # Existing orders remain accessible to the shop owner.
    if not is_shop_eligible(db, shop):
        raise HTTPException(
            status_code=403,
            detail=(
                "This partner shop is not accepting new orders "
                "because its subscription is inactive or expired."
            ),
        )

    order = Order(
        customer_id=current_user.id,
        shop_id=shop.id,
        grocery_basket_id=basket.id,
        basket_snapshot=basket.basket_data,
        estimated_total_lkr=Decimal(
            str(basket.estimated_total_lkr)
        ),
        status="pending",
    )

    try:
        db.add(order)
        db.flush()

        create_order_items(order, db)

        # Notify the selected partner shop owner about the new basket.
        create_shop_owner_notification(
            db=db,
            shop_owner_id=shop.id,
            order_id=order.id,
            title="New Grocery Basket Request",
            message=(
                f"You have received a new grocery basket request "
                f"(Order #{order.id}) from {current_user.full_name}. "
                f"Please review the basket and update its status."
            ),
        )

        # Notify active admins about the newly submitted order.
        notify_all_admins(
            db=db,
            title="New Order Received",
            message=(
                f"Order #{order.id} was placed by "
                f"{current_user.full_name} "
                f"for partner shop {shop.shop_name}."
            ),
            order_id=order.id,
        )

        # Flush pending order items and notifications before committing.
        db.flush()
        print(
            f"[ORDER DEBUG] Before commit: order_id={order.id}, "
            f"shop_owner_id={shop.id}",
            flush=True,
        )
        db.commit()
        db.refresh(order)
        print(
            f"[ORDER DEBUG] COMMITTED: order_id={order.id}, "
            f"shop_owner_id={shop.id}",
            flush=True,
        )

    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except Exception as error:
        db.rollback()
        print(f"[ORDER DEBUG] ROLLBACK: {error!r}", flush=True)
        raise HTTPException(
            status_code=500,
            detail="Could not create order.",
        ) from error

    return {
        "message": "Basket sent to partner shop successfully.",
        "order": serialize_order(order, db),
    }


# ========================================
# 2. CUSTOMER VIEW MY ORDERS
# ========================================

@router.get("/my")
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    orders = (
        db.query(Order)
        .filter(
            Order.customer_id == current_user.id
        )
        .order_by(
            Order.created_at.desc(),
            Order.id.desc(),
        )
        .all()
    )

    return {
        "total_orders": len(orders),
        "orders": [
            serialize_order(order, db)
            for order in orders
        ],
    }


# ========================================
# 3. SHOP OWNER VIEW RECEIVED ORDERS
# ========================================

@router.get("/shop/received")
def get_shop_received_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    orders = (
        db.query(Order)
        .filter(
            Order.shop_id == current_user.id
        )
        .order_by(
            Order.created_at.desc(),
            Order.id.desc(),
        )
        .all()
    )

    return {
        "total_orders": len(orders),
        "orders": [
            serialize_order(
                order,
                db,
                include_customer_details=True,
            )
            for order in orders
        ],
    }


# ========================================
# 4. CUSTOMER OR SHOP VIEW ORDER DETAILS
# ========================================

@router.get("/{order_id}")
def get_order_details(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_accessible_order(
        order_id,
        db,
        current_user,
    )

    return serialize_order(
        order,
        db,
        include_customer_details=(
            current_user.role == "shop_owner"
            and current_user.id == order.shop_id
        ),
    )


# ========================================
# 5. SHOP OWNER UPDATE ORDER STATUS
# ========================================

@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: UpdateOrderStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.shop_id == current_user.id,
        )
        .with_for_update()
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    allowed_transitions = {
        "pending": {"accepted", "rejected"},
        "accepted": {"preparing", "cancelled"},
        "preparing": {"ready"},
        "ready": {"completed"},
        "rejected": set(),
        "cancelled": set(),
        "completed": set(),
    }

    new_status = payload.status.strip().lower()

    if new_status not in allowed_transitions.get(
        order.status, set()
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot change order status "
                f"from {order.status} to {new_status}."
            ),
        )

    order.status = new_status

    status_messages = {
        "accepted": "Your order has been accepted.",
        "rejected": "Your order has been rejected.",
        "preparing": "Your order is being prepared.",
        "ready": "Your order is ready.",
        "completed": "Your order has been completed.",
        "cancelled": "Your order has been cancelled.",
    }

    create_customer_notification(
        db=db,
        customer_id=order.customer_id,
        order_id=order.id,
        title="Order Status Updated",
        message=(
            f"Order #{order.id}: "
            f"{status_messages[new_status]}"
        ),
    )

    try:
        db.commit()
        db.refresh(order)

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update order status.",
        ) from error

    return {
        "message": "Order status updated successfully.",
        "order": serialize_order(
            order,
            db,
            include_customer_details=True,
        ),
    }


# ========================================
# 6. CUSTOMER OR SHOP VIEW ORDER ITEMS
# ========================================

@router.get("/{order_id}/items")
def get_order_items(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_accessible_order(
        order_id,
        db,
        current_user,
    )

    items = (
        db.query(OrderItem)
        .filter(
            OrderItem.order_id == order.id
        )
        .order_by(
            OrderItem.item_index.asc()
        )
        .all()
    )

    return {
        "order_id": order.id,
        "order_status": order.status,
        "total_items": len(items),
        "items": [
            serialize_order_item(item)
            for item in items
        ],
    }


# ========================================
# 7. SHOP OWNER UPDATE ITEM AVAILABILITY
# ========================================

@router.patch("/{order_id}/items/{item_id}")
def update_item_availability(
    order_id: int,
    item_id: int,
    payload: UpdateItemAvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.shop_id == current_user.id,
        )
        .with_for_update()
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    if order.status in {
        "rejected",
        "cancelled",
        "completed",
    }:
        raise HTTPException(
            status_code=400,
            detail="This order can no longer be updated.",
        )

    new_status = (
        payload.availability_status.strip().lower()
    )

    allowed_statuses = {
        "available",
        "low_stock",
        "unavailable",
    }

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail="Invalid availability status.",
        )

    item = (
        db.query(OrderItem)
        .filter(
            OrderItem.id == item_id,
            OrderItem.order_id == order.id,
        )
        .with_for_update()
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Order item not found.",
        )

    old_status = item.availability_status

    if old_status == new_status:
        return {
            "message": "Item availability is unchanged.",
            "item": serialize_order_item(item),
            "notification_created": False,
        }

    item.availability_status = new_status

    notification_created = False

    if new_status == "unavailable":
        create_customer_notification(
            db=db,
            customer_id=order.customer_id,
            order_id=order.id,
            title="Grocery Item Unavailable",
            message=(
                f"Order #{order.id}: "
                f"{item.item_name} "
                f"({item.quantity} {item.unit}) "
                f"is unavailable at your selected shop."
            ),
        )

        notification_created = True

    elif new_status == "low_stock":
        create_customer_notification(
            db=db,
            customer_id=order.customer_id,
            order_id=order.id,
            title="Grocery Item Low Stock",
            message=(
                f"Order #{order.id}: "
                f"{item.item_name} is currently "
                f"low in stock at your selected shop."
            ),
        )

        notification_created = True

    try:
        db.commit()
        db.refresh(item)

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update item availability.",
        ) from error

    return {
        "message": "Item availability updated successfully.",
        "item": serialize_order_item(item),
        "notification_created": notification_created,
    }
