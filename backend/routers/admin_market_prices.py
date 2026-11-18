
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models.market_price import MarketPrice
from models.user import User
from routers.admin import require_admin
from services.grocery_basket_service import (
    normalize_ingredient_name,
)

router = APIRouter(
    prefix="/admin/market-prices",
    tags=["Admin Market Prices"],
    dependencies=[Depends(require_admin)],
)


# =====================================
# PYDANTIC SCHEMAS
# =====================================

class MarketPriceCreate(BaseModel):
    ingredient_name: str = Field(min_length=1, max_length=150)
    price_per_unit: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    unit: str = Field(min_length=1, max_length=20)
    market_location: str = Field(min_length=1, max_length=100)

    @field_validator(
        "ingredient_name",
        "unit",
        "market_location",
    )
    @classmethod
    def validate_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty")
        return value


class MarketPriceUpdate(MarketPriceCreate):
    pass


class MarketPriceResponse(BaseModel):
    id: int
    ingredient_name: str
    price_per_unit: Decimal
    unit: str
    market_location: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================
# GET ALL MARKET PRICES
# =====================================

@router.get(
    "",
    response_model=list[MarketPriceResponse],
)
def get_market_prices(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(MarketPrice).order_by(
            MarketPrice.ingredient_name,
            MarketPrice.market_location,
            MarketPrice.id,
        )
    ).all()


# =====================================
# GET SINGLE MARKET PRICE
# =====================================

@router.get(
    "/{price_id}",
    response_model=MarketPriceResponse,
)
def get_market_price(
    price_id: int,
    db: Session = Depends(get_db),
):
    price = db.get(MarketPrice, price_id)

    if price is None:
        raise HTTPException(
            status_code=404,
            detail="Market price not found",
        )

    return price


# =====================================
# ADD MARKET PRICE
# =====================================

@router.post(
    "",
    response_model=MarketPriceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_market_price(
    payload: MarketPriceCreate,
    db: Session = Depends(get_db),
):
    ingredient = normalize_ingredient_name(
        payload.ingredient_name
    )

    existing = db.scalar(
        select(MarketPrice).where(
            MarketPrice.ingredient_name == ingredient,
            MarketPrice.unit == payload.unit.lower(),
            MarketPrice.market_location == payload.market_location,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Price already exists for this ingredient, unit and market",
        )

    price = MarketPrice(
        ingredient_name=ingredient,
        price_per_unit=payload.price_per_unit,
        unit=payload.unit.lower(),
        market_location=payload.market_location,
    )

    db.add(price)
    db.commit()
    db.refresh(price)

    return price


# =====================================
# UPDATE MARKET PRICE
# =====================================

@router.put(
    "/{price_id}",
    response_model=MarketPriceResponse,
)
def update_market_price(
    price_id: int,
    payload: MarketPriceUpdate,
    db: Session = Depends(get_db),
):
    price = db.get(MarketPrice, price_id)

    if price is None:
        raise HTTPException(
            status_code=404,
            detail="Market price not found",
        )

    ingredient = normalize_ingredient_name(
        payload.ingredient_name
    )

    duplicate = db.scalar(
        select(MarketPrice).where(
            MarketPrice.id != price_id,
            MarketPrice.ingredient_name == ingredient,
            MarketPrice.unit == payload.unit.lower(),
            MarketPrice.market_location == payload.market_location,
        )
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="Another price record already exists",
        )

    price.ingredient_name = ingredient
    price.price_per_unit = payload.price_per_unit
    price.unit = payload.unit.lower()
    price.market_location = payload.market_location

    db.commit()
    db.refresh(price)

    return price


# =====================================
# DELETE MARKET PRICE
# =====================================

@router.delete(
    "/{price_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_market_price(
    price_id: int,
    db: Session = Depends(get_db),
):
    price = db.get(MarketPrice, price_id)

    if price is None:
        raise HTTPException(
            status_code=404,
            detail="Market price not found",
        )

    db.delete(price)
    db.commit()
