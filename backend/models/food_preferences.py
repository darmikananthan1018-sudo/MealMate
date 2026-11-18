
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class FoodPreferences(Base):
    __tablename__ = "food_preferences"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    family_members: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    weekly_budget: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    diet_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Meal Plan Start Day
    # Today, Monday, Tuesday, Wednesday,
    # Thursday, Friday, Saturday, Sunday

    start_day: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Today",
        server_default="Today",
    )

    health_conditions: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    preferred_foods: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    disliked_foods: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
