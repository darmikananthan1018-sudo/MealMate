
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# Allowed Meal Plan Start Days
StartDay = Literal[
    "Today",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


class FoodPreferencesBase(BaseModel):

    family_members: int = Field(
        ...,
        ge=1,
        le=1000,
    )

    weekly_budget: Decimal = Field(
        ...,
        gt=0,
        max_digits=10,
        decimal_places=2,
    )

    diet_type: str = Field(
        ...,
        min_length=2,
        max_length=50,
    )

    # New: Meal Plan Start Day
    start_day: StartDay = Field(
        default="Today",
        description="Starting day for the 7-day meal plan",
    )

    health_conditions: list[str] = Field(
        default_factory=list,
    )

    preferred_foods: list[str] = Field(
        default_factory=list,
    )

    disliked_foods: list[str] = Field(
        default_factory=list,
    )


class FoodPreferencesCreate(FoodPreferencesBase):
    pass


class FoodPreferencesUpdate(BaseModel):

    family_members: int | None = Field(
        default=None,
        ge=1,
        le=1000,
    )

    weekly_budget: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
    )

    diet_type: str | None = Field(
        default=None,
        min_length=2,
        max_length=50,
    )

    # New: Optional Start Day Update
    start_day: StartDay | None = None

    health_conditions: list[str] | None = None

    preferred_foods: list[str] | None = None

    disliked_foods: list[str] | None = None


class FoodPreferencesResponse(FoodPreferencesBase):

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )
