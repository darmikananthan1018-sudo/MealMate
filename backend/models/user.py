
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    # =====================================
    # USER ID
    # =====================================

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # =====================================
    # BASIC USER DETAILS
    # =====================================

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # =====================================
    # USER ROLE AND STATUS
    # =====================================

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="customer",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    # =====================================
    # GOOGLE AUTHENTICATION
    # =====================================

    google_sub: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    # =====================================
    # SHOP OWNER BASIC DETAILS
    # =====================================

    shop_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    approval_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    # =====================================
    # CUSTOMER / SHOP OWNER PROFILE PHOTO
    # =====================================

    profile_photo: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # =====================================
    # SHOP OWNER PROFILE DETAILS - NEW
    # =====================================

    shop_description: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    opening_hours: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # =====================================
    # SHOP BRANDING - NEW
    # =====================================

    shop_logo: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    shop_cover_photo: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
