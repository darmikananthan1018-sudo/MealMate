
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ShopHighlight(Base):
    __tablename__ = "shop_highlights"

    __table_args__ = (
        UniqueConstraint(
            "shop_owner_id",
            "title",
            name="uq_shop_highlight_title",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    shop_owner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
    )

    is_custom: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_selected: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
