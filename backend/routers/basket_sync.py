
"""Save customer edits to an existing AI grocery basket.
Add to backend/routers/basket_sync.py and include router in main.py.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models.grocery_basket import GroceryBasket
from models.user import User
from routers.auth import get_current_user


router = APIRouter(
    prefix="/basket-sync",
    tags=["Grocery Basket Sync"],
)


class BasketItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=30)
    estimated_unit_price_lkr: Decimal = Field(ge=0)
    estimated_total_price_lkr: Decimal = Field(ge=0)
    days_used: List[str] = Field(default_factory=list)

    @field_validator("name", "unit")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Cannot be blank")
        return value.strip()


class BasketSyncInput(BaseModel):
    items: List[BasketItemInput] = Field(max_length=300)


@router.put("/{basket_id}")
def save_edited_basket(
    basket_id: int,
    data: BasketSyncInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Only customers can edit grocery baskets.",
        )

    basket = (
        db.query(GroceryBasket)
        .filter(
            GroceryBasket.id == basket_id,
            GroceryBasket.user_id == current_user.id,
        )
        .first()
    )

    if basket is None:
        raise HTTPException(
            status_code=404,
            detail="Your grocery basket was not found.",
        )

    rows = []
    total = Decimal("0.00")

    for item in data.items:
        row_total = item.estimated_total_price_lkr.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        total += row_total

        rows.append({
            "name": item.name,
            "quantity": float(item.quantity),
            "unit": item.unit,
            "estimated_unit_price_lkr": float(
                item.estimated_unit_price_lkr
            ),
            "estimated_total_price_lkr": float(row_total),
            "days_used": item.days_used,
        })

    old_data = (
        basket.basket_data
        if isinstance(basket.basket_data, dict)
        else {}
    )

    basket.basket_data = {
        **old_data,
        "items": rows,
    }

    basket.estimated_total_lkr = total

    flag_modified(basket, "basket_data")

    try:
        db.commit()
        db.refresh(basket)

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to save basket changes.",
        ) from error

    return {
        "message": "Basket updated successfully",
        "id": basket.id,
        "estimated_total_lkr": float(total),
        "grocery_basket": basket.basket_data,
    }
