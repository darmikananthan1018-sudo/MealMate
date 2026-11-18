
from database import Base, engine

from models.user import User
from models.food_preferences import FoodPreferences
from models.meal_plan import MealPlan
from models.grocery_basket import GroceryBasket


def main():
    Base.metadata.create_all(
        bind=engine,
        tables=[
            MealPlan.__table__,
            GroceryBasket.__table__,
        ],
        checkfirst=True,
    )

    print("MealMate meal_plans table created/verified!")
    print("MealMate grocery_baskets table created/verified!")


if __name__ == "__main__":
    main()
