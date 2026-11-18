
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# =====================================
# SUBSCRIPTION PLAN RESPONSE
# =====================================

class SubscriptionPlanResponse(BaseModel):
    id: int
    name: str
    user_role: str
    price: Decimal
    duration_days: int
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


# =====================================
# USER SUBSCRIPTION RESPONSE
# =====================================

class UserSubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan_id: int
    status: str
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================
# SUBSCRIPTION CHECKOUT REQUEST
# =====================================

class SubscriptionCheckoutRequest(BaseModel):
    plan_id: int


# =====================================
# SUBSCRIPTION PAYMENT RESPONSE
# =====================================

class SubscriptionPaymentResponse(BaseModel):
    id: int
    subscription_id: int
    amount: Decimal
    currency: str
    payment_status: str
    transaction_id: str | None = None
    paid_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
