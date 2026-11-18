
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class UserRegister(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    role: Literal["customer"] = "customer"

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if not any(c.isalpha() for c in value):
            raise ValueError(
                "Password must contain a letter"
            )

        if not any(c.isdigit() for c in value):
            raise ValueError(
                "Password must contain a number"
            )

        return value


class ShopOwnerRegister(UserRegister):
    role: Literal["shop_owner"] = "shop_owner"

    shop_name: str = Field(
        min_length=2,
        max_length=150,
    )

    phone: str = Field(
        min_length=7,
        max_length=20,
    )

    address: str = Field(
        min_length=5,
        max_length=255,
    )


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    shop_name: str | None = None
    phone: str | None = None
    address: str | None = None
    approval_status: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ApprovalUpdate(BaseModel):
    approval_status: Literal[
        "approved",
        "rejected",
    ]


