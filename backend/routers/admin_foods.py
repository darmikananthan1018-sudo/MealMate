
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models.food import Food
from routers.admin import require_admin


router = APIRouter(
    prefix="/admin/foods",
    tags=["Admin Food Management"],
    dependencies=[Depends(require_admin)],
)


# ========================================
# PYDANTIC SCHEMAS
# ========================================

class FoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=50)
    diet_type: str = Field(min_length=1, max_length=50)
    description: str | None = None

    # Nutrition values per serving
    calories: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    protein: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    carbs: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    fat: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    fiber: Decimal = Field(ge=0, max_digits=10, decimal_places=2)

    @field_validator("name", "category", "diet_type")
    @classmethod
    def validate_required_text(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty.")

        return value


class FoodUpdate(FoodCreate):
    pass


class FoodResponse(FoodCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ========================================
# GET ALL FOODS
# ========================================

@router.get("", response_model=list[FoodResponse])
def get_all_foods(db: Session = Depends(get_db)):

    return (
        db.query(Food)
        .order_by(Food.id.desc())
        .all()
    )


# ========================================
# GET SINGLE FOOD
# ========================================

@router.get("/{food_id}", response_model=FoodResponse)
def get_food(
    food_id: int,
    db: Session = Depends(get_db),
):

    food = db.get(Food, food_id)

    if not food:
        raise HTTPException(
            status_code=404,
            detail="Food not found.",
        )

    return food


# ========================================
# CREATE FOOD
# ========================================

@router.post(
    "",
    response_model=FoodResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_food(
    data: FoodCreate,
    db: Session = Depends(get_db),
):

    food = Food(**data.model_dump())

    try:
        db.add(food)
        db.commit()
        db.refresh(food)

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create food.",
        )

    return food


# ========================================
# UPDATE FOOD
# ========================================

@router.put(
    "/{food_id}",
    response_model=FoodResponse,
)
def update_food(
    food_id: int,
    data: FoodUpdate,
    db: Session = Depends(get_db),
):

    food = db.get(Food, food_id)

    if not food:
        raise HTTPException(
            status_code=404,
            detail="Food not found.",
        )

    for field, value in data.model_dump().items():
        setattr(food, field, value)

    try:
        db.commit()
        db.refresh(food)

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update food.",
        )

    return food


# ========================================
# DELETE FOOD
# ========================================

@router.delete(
    "/{food_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_food(
    food_id: int,
    db: Session = Depends(get_db),
):

    food = db.get(Food, food_id)

    if not food:
        raise HTTPException(
            status_code=404,
            detail="Food not found.",
        )

    try:
        db.delete(food)
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete food.",
        )

    return None
