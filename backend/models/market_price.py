
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Integer,
    Numeric,
    String,
    func
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    ingredient_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True
    )

    price_per_unit: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    market_location: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )
