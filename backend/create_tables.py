
from database import Base, engine

# ========================================
# EXISTING MODELS
# ========================================

from models.user import User
from models.food_preferences import FoodPreferences
from models.market_price import MarketPrice
from models.meal_plan import MealPlan
from models.grocery_basket import GroceryBasket
from models.order import Order

# ========================================
# SHOP OWNER & NOTIFICATION MODELS
# ========================================

from models.order_item import OrderItem
from models.notification import Notification

# ========================================
# ADMIN FOOD MANAGEMENT MODEL
# ========================================

from models.food import Food


# ========================================
# CREATE DATABASE TABLES
# ========================================

def create_tables():

    Base.metadata.create_all(bind=engine)

    print("===================================")
    print("MealMate Database Setup")
    print("===================================")

    print("All registered tables checked.")

    print("Users table ready.")
    print("Food Preferences table ready.")
    print("Market Prices table ready.")
    print("Meal Plans table ready.")
    print("Grocery Baskets table ready.")
    print("Orders table ready.")
    print("Order Items table ready.")
    print("Notifications table ready.")
    print("Foods table ready.")

    print("===================================")
    print("Database setup completed!")
    print("===================================")


if __name__ == "__main__":
    create_tables()
