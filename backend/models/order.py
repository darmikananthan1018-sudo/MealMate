
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


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    customer_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    shop_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    grocery_basket_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("grocery_baskets.id"),
        nullable=False,
        index=True,
    )

    basket_snapshot: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    estimated_total_lkr: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
