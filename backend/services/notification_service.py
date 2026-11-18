
from sqlalchemy.orm import Session

from models.notification import Notification
from models.user import User


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    order_id: int | None = None,
):
    notification = Notification(
        user_id=user_id,
        order_id=order_id,
        title=title,
        message=message,
        is_read=False,
    )

    db.add(notification)

    return notification


def notify_all_admins(
    db: Session,
    title: str,
    message: str,
    order_id: int | None = None,
):
    admins = (
        db.query(User)
        .filter(
            User.role == "admin",
            User.is_active.is_(True),
        )
        .all()
    )

    for admin in admins:
        create_notification(
            db=db,
            user_id=admin.id,
            title=title,
            message=message,
            order_id=order_id,
        )
