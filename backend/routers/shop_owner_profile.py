
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.shop_offer import ShopOffer
from models.shop_highlight import ShopHighlight
from routers.auth import get_current_user


router = APIRouter(
    prefix="/shop-owner/profile",
    tags=["Shop Owner Profile"],
)

PRESET_HIGHLIGHTS = [
    "Fresh Grocery Selection",
    "Budget-Friendly Prices",
    "Locally Sourced Products",
    "Vegetarian-Friendly Options",
    "Flexible Pickup Hours",
    "Quick Basket Confirmation",
]


def require_shop_owner(user: User):
    if user.role != "shop_owner":
        raise HTTPException(403, "Shop owner access only")


def serialize_profile(user: User):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "shop_name": user.shop_name,
        "phone": user.phone,
        "address": user.address,
        "profile_photo": user.profile_photo,
        "shop_description": user.shop_description,
        "opening_hours": user.opening_hours,
        "shop_logo": user.shop_logo,
        "shop_cover_photo": user.shop_cover_photo,
        "approval_status": user.approval_status,
    }


def serialize_offer(offer: ShopOffer):
    return {
        "id": offer.id,
        "title": offer.title,
        "offer_type": offer.offer_type,
        "amount": float(offer.amount) if offer.amount is not None else None,
        "description": offer.description,
        "start_date": offer.start_date,
        "end_date": offer.end_date,
        "is_active": offer.is_active,
    }


def serialize_highlight(highlight: ShopHighlight):
    return {
        "id": highlight.id,
        "title": highlight.title,
        "is_custom": highlight.is_custom,
        "is_selected": highlight.is_selected,
    }


class ShopProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    shop_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)
    shop_description: str | None = Field(default=None, max_length=1000)
    opening_hours: str | None = Field(default=None, max_length=255)


class OfferInput(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    offer_type: str
    amount: Decimal | None = None
    description: str | None = None
    start_date: date
    end_date: date
    is_active: bool = True

    @model_validator(mode="after")
    def validate_offer(self):
        if self.offer_type not in {"percentage", "fixed", "promotion"}:
            raise ValueError("Invalid offer type")

        if self.end_date < self.start_date:
            raise ValueError("End date must not be before start date")

        if self.offer_type in {"percentage", "fixed"}:
            if self.amount is None or not self.amount.is_finite():
                raise ValueError("Discount amount is required")
            if self.amount <= 0:
                raise ValueError("Discount amount must be positive")
            if self.offer_type == "percentage" and self.amount > 100:
                raise ValueError("Percentage cannot exceed 100")
            if self.amount > Decimal("99999999.99"):
                raise ValueError("Discount amount is too large")
        elif self.amount is not None:
            raise ValueError("Promotion amount must be empty")

        return self


class HighlightInput(BaseModel):
    title: str = Field(min_length=2, max_length=60)
    is_custom: bool = False
    is_selected: bool = True


class HighlightUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=60)
    is_selected: bool | None = None


@router.get("/me")
def get_shop_profile(
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)
    return serialize_profile(current_user)


@router.put("/me")
def update_shop_profile(
    payload: ShopProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    name = payload.full_name.strip()
    shop_name = payload.shop_name.strip()
    email = str(payload.email).strip().lower()

    if len(name) < 2 or len(shop_name) < 2:
        raise HTTPException(422, "Name must contain at least 2 characters")

    duplicate = db.query(User).filter(
        func.lower(User.email) == email,
        User.id != current_user.id,
    ).first()

    if duplicate:
        raise HTTPException(409, "Email already registered")

    current_user.full_name = name
    current_user.shop_name = shop_name
    current_user.email = email

    for field in (
        "phone",
        "address",
        "shop_description",
        "opening_hours",
    ):
        value = getattr(payload, field)
        setattr(current_user, field, value.strip() or None if value else None)

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")

    return serialize_profile(current_user)


@router.get("/offers")
def list_offers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    offers = db.query(ShopOffer).filter(
        ShopOffer.shop_owner_id == current_user.id,
    ).order_by(ShopOffer.id.desc()).all()

    return [serialize_offer(offer) for offer in offers]


@router.post("/offers", status_code=201)
def create_offer(
    payload: OfferInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    offer = ShopOffer(
        shop_owner_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return serialize_offer(offer)


@router.put("/offers/{offer_id}")
def update_offer(
    offer_id: int,
    payload: OfferInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    offer = db.query(ShopOffer).filter(
        ShopOffer.id == offer_id,
        ShopOffer.shop_owner_id == current_user.id,
    ).first()

    if not offer:
        raise HTTPException(404, "Offer not found")

    for field, value in payload.model_dump().items():
        setattr(offer, field, value)

    db.commit()
    db.refresh(offer)
    return serialize_offer(offer)


@router.delete("/offers/{offer_id}")
def delete_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    offer = db.query(ShopOffer).filter(
        ShopOffer.id == offer_id,
        ShopOffer.shop_owner_id == current_user.id,
    ).first()

    if not offer:
        raise HTTPException(404, "Offer not found")

    db.delete(offer)
    db.commit()
    return {"message": "Offer deleted successfully"}


@router.get("/highlights")
def list_highlights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    highlights = db.query(ShopHighlight).filter(
        ShopHighlight.shop_owner_id == current_user.id,
    ).order_by(ShopHighlight.id).all()

    return {
        "presets": PRESET_HIGHLIGHTS,
        "highlights": [serialize_highlight(h) for h in highlights],
    }


@router.post("/highlights", status_code=201)
def create_highlight(
    payload: HighlightInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    title = " ".join(payload.title.split())

    if len(title) < 2:
        raise HTTPException(422, "Highlight is too short")

    preset = next(
        (p for p in PRESET_HIGHLIGHTS if p.casefold() == title.casefold()),
        None,
    )

    if not payload.is_custom and preset is None:
        raise HTTPException(422, "Select a valid preset highlight")

    if payload.is_custom and preset is not None:
        raise HTTPException(422, "This highlight is already a preset")

    duplicate = db.query(ShopHighlight).filter(
        ShopHighlight.shop_owner_id == current_user.id,
        func.lower(ShopHighlight.title) == title.lower(),
    ).first()

    if duplicate:
        raise HTTPException(409, "Highlight already exists")

    highlight = ShopHighlight(
        shop_owner_id=current_user.id,
        title=preset or title,
        is_custom=payload.is_custom,
        is_selected=payload.is_selected,
    )

    db.add(highlight)
    try:
        db.commit()
        db.refresh(highlight)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Highlight already exists")

    return serialize_highlight(highlight)


@router.patch("/highlights/{highlight_id}")
def update_highlight(
    highlight_id: int,
    payload: HighlightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    highlight = db.query(ShopHighlight).filter(
        ShopHighlight.id == highlight_id,
        ShopHighlight.shop_owner_id == current_user.id,
    ).first()

    if not highlight:
        raise HTTPException(404, "Highlight not found")

    if payload.title is not None:
        if not highlight.is_custom:
            raise HTTPException(422, "Preset highlight cannot be renamed")

        title = " ".join(payload.title.split())
        if len(title) < 2:
            raise HTTPException(422, "Highlight is too short")

        if any(p.casefold() == title.casefold() for p in PRESET_HIGHLIGHTS):
            raise HTTPException(409, "This highlight is already a preset")

        duplicate = db.query(ShopHighlight).filter(
            ShopHighlight.shop_owner_id == current_user.id,
            ShopHighlight.id != highlight.id,
            func.lower(ShopHighlight.title) == title.lower(),
        ).first()

        if duplicate:
            raise HTTPException(409, "Highlight already exists")

        highlight.title = title

    if payload.is_selected is not None:
        highlight.is_selected = payload.is_selected

    try:
        db.commit()
        db.refresh(highlight)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Highlight already exists")

    return serialize_highlight(highlight)


@router.delete("/highlights/{highlight_id}")
def delete_highlight(
    highlight_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    highlight = db.query(ShopHighlight).filter(
        ShopHighlight.id == highlight_id,
        ShopHighlight.shop_owner_id == current_user.id,
    ).first()

    if not highlight:
        raise HTTPException(404, "Highlight not found")

    if not highlight.is_custom:
        raise HTTPException(422, "Preset highlights cannot be deleted")

    db.delete(highlight)
    db.commit()
    return {"message": "Highlight deleted successfully"}
