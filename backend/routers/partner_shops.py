from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import MetaData, select
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from routers.auth import get_current_user
from services.shop_subscription_service import is_shop_eligible

router = APIRouter(prefix="/partner-shops", tags=["Partner Shops"])


def find_table(db: Session, possible_names):
    metadata = MetaData()
    metadata.reflect(bind=db.get_bind())
    for name in possible_names:
        if name in metadata.tables:
            return metadata.tables[name]
    return None


def get_shop_records(db, table, shop_id):
    if table is None:
        return []
    columns = table.c.keys()
    owner_column = next(
        (name for name in ("shop_owner_id", "owner_id", "user_id", "shop_id") if name in columns),
        None,
    )
    if owner_column is None:
        return []
    query = select(table).where(table.c[owner_column] == shop_id)
    return [dict(row._mapping) for row in db.execute(query).fetchall()]


def serialize_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def get_shop_offers(db: Session, shop_id: int):
    table = find_table(db, ["shop_offers", "shop_owner_offers", "partner_shop_offers"])
    records = get_shop_records(db, table, shop_id)
    today = date.today()
    offers = []
    for record in records:
        if not record.get("is_active", False):
            continue
        start = record.get("start_date")
        end = record.get("end_date")
        if isinstance(start, datetime):
            start = start.date()
        if isinstance(end, datetime):
            end = end.date()
        if isinstance(start, str):
            start = date.fromisoformat(start[:10])
        if isinstance(end, str):
            end = date.fromisoformat(end[:10])
        if start and start > today:
            continue
        if end and end < today:
            continue
        offers.append({
            "id": record.get("id"),
            "title": record.get("title"),
            "offer_type": record.get("offer_type"),
            "amount": float(record["amount"]) if record.get("amount") is not None else None,
            "description": record.get("description"),
            "start_date": serialize_value(record.get("start_date")),
            "end_date": serialize_value(record.get("end_date")),
            "is_active": True,
        })
    return offers


def get_shop_highlights(db: Session, shop_id: int):
    table = find_table(db, ["shop_highlights", "shop_owner_highlights", "partner_shop_highlights"])
    records = get_shop_records(db, table, shop_id)
    highlights = []
    for record in records:
        if not record.get("is_selected", False):
            continue
        title = record.get("title")
        if not title:
            continue
        highlights.append({
            "id": record.get("id"),
            "title": title,
            "is_custom": bool(record.get("is_custom", False)),
            "is_selected": True,
        })
    return highlights


def serialize_shop(shop: User, db: Session):
    return {
        "id": shop.id,
        "shop_name": shop.shop_name,
        "phone": shop.phone,
        "address": shop.address,
        "approval_status": shop.approval_status,
        "shop_logo": getattr(shop, "shop_logo", None),
        "shop_cover_photo": getattr(shop, "shop_cover_photo", None),
        "shop_description": getattr(shop, "shop_description", None),
        "opening_hours": getattr(shop, "opening_hours", None),
        "offers": get_shop_offers(db, shop.id),
        "highlights": get_shop_highlights(db, shop.id),
    }


@router.get("")
def get_partner_shops(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Only customers can view partner shops.")

    approved_shops = (
        db.query(User)
        .filter(
            User.role == "shop_owner",
            User.is_active.is_(True),
            User.approval_status == "approved",
        )
        .order_by(User.shop_name.asc())
        .all()
    )
    eligible_shops = [shop for shop in approved_shops if is_shop_eligible(db, shop)]
    return {
        "total_shops": len(eligible_shops),
        "shops": [serialize_shop(shop, db) for shop in eligible_shops],
    }


@router.get("/{shop_id}")
def get_partner_shop_details(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(status_code=403, detail="Only customers can view partner shops.")

    shop = (
        db.query(User)
        .filter(
            User.id == shop_id,
            User.role == "shop_owner",
            User.is_active.is_(True),
            User.approval_status == "approved",
        )
        .first()
    )
    if not shop or not is_shop_eligible(db, shop):
        raise HTTPException(status_code=404, detail="Available partner shop not found.")
    return serialize_shop(shop, db)

