
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "item_index",
            name="uq_order_item_index",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    item_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    availability_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
