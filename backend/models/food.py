
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Food(Base):
    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    diet_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    calories: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    protein: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    carbs: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    fat: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    fiber: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
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
