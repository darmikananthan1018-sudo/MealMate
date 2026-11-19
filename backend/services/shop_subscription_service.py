
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.user import User
from models.subscription import (
    SubscriptionPlan,
    UserSubscription,
)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_valid_shop_subscription(
    db: Session,
    shop_owner_id: int,
):
    now = utc_now()

    return db.scalar(
        select(UserSubscription)
        .join(
            SubscriptionPlan,
            UserSubscription.plan_id == SubscriptionPlan.id,
        )
        .where(
            UserSubscription.user_id == shop_owner_id,
            SubscriptionPlan.user_role == "shop_owner",
            UserSubscription.status == "active",
            UserSubscription.start_date.is_not(None),
            UserSubscription.start_date <= now,
            UserSubscription.end_date.is_not(None),
            UserSubscription.end_date > now,
        )
        .order_by(UserSubscription.end_date.desc())
    )


def is_shop_eligible(
    db: Session,
    shop: User,
) -> bool:
    if (
        shop.role != "shop_owner"
        or not shop.is_active
        or shop.approval_status != "approved"
    ):
        return False

    return get_valid_shop_subscription(
        db,
        shop.id,
    ) is not None
