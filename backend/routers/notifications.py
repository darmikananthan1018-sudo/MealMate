
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.notification import Notification
from routers.auth import get_current_user


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.get("/my")
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id
        )
        .order_by(
            Notification.created_at.desc(),
            Notification.id.desc(),
        )
        .all()
    )

    return {
        "total_notifications": len(notifications),
        "unread_count": sum(
            not notification.is_read
            for notification in notifications
        ),
        "notifications": [
            {
                "id": notification.id,
                "order_id": notification.order_id,
                "title": notification.title,
                "message": notification.message,
                "is_read": notification.is_read,
                "created_at": (
                    notification.created_at.isoformat()
                    if notification.created_at
                    else None
                ),
            }
            for notification in notifications
        ],
    }


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.is_read = True

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update notification.",
        )

    return {
        "message": "Notification marked as read.",
        "notification_id": notification.id,
        "is_read": True,
    }
