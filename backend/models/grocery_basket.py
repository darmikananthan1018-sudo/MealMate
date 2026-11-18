
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class GroceryBasket(Base):
    __tablename__ = "grocery_baskets"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    meal_plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("meal_plans.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    basket_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    estimated_total_lkr: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
