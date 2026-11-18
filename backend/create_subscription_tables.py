
from database import Base, engine

# Existing users table reference
from models.user import User

# Subscription models
from models.subscription import (
    SubscriptionPlan,
    UserSubscription,
    SubscriptionPayment,
)


def create_subscription_tables():
    print("Creating MealMate subscription tables...")

    Base.metadata.create_all(
        bind=engine,
        tables=[
            SubscriptionPlan.__table__,
            UserSubscription.__table__,
            SubscriptionPayment.__table__,
        ],
    )

    print("Subscription tables created successfully!")


if __name__ == "__main__":
    create_subscription_tables()
