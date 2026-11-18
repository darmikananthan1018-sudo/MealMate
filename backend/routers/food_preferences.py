
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models.food_preferences import FoodPreferences
from models.user import User
from routers.auth import get_current_user

from schemas.food_preferences import (
    FoodPreferencesCreate,
    FoodPreferencesUpdate,
    FoodPreferencesResponse,
)


router = APIRouter(
    prefix="/food-preferences",
    tags=["Food Preferences"],
)


def get_current_customer(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access food preferences.",
        )

    return current_user


@router.post(
    "",
    response_model=FoodPreferencesResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_food_preferences(
    data: FoodPreferencesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):

    existing = (
        db.query(FoodPreferences)
        .filter(
            FoodPreferences.user_id == current_user.id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Food preferences already exist. Use PUT to update.",
        )

    preferences = FoodPreferences(
        user_id=current_user.id,
        **data.model_dump(),
    )

    try:
        db.add(preferences)
        db.commit()
        db.refresh(preferences)

    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save food preferences.",
        ) from error

    return preferences


@router.get(
    "/me",
    response_model=FoodPreferencesResponse,
)
def get_my_food_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):

    preferences = (
        db.query(FoodPreferences)
        .filter(
            FoodPreferences.user_id == current_user.id
        )
        .first()
    )

    if not preferences:
        raise HTTPException(
            status_code=404,
            detail="Food preferences not found.",
        )

    return preferences


@router.put(
    "/me",
    response_model=FoodPreferencesResponse,
)
def update_my_food_preferences(
    data: FoodPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):

    preferences = (
        db.query(FoodPreferences)
        .filter(
            FoodPreferences.user_id == current_user.id
        )
        .first()
    )

    if not preferences:
        raise HTTPException(
            status_code=404,
            detail="Food preferences not found. Create them first.",
        )

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():

        if value is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null.",
            )

        setattr(preferences, field, value)

    try:
        db.commit()
        db.refresh(preferences)

    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update food preferences.",
        ) from error

    return preferences
