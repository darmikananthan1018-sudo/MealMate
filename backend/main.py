
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html


# ========================================
# ROUTER IMPORTS
# ========================================

from routers import notifications
from routers import basket_sync
from routers import customer_profile
from routers import admin_market_prices

from routers.auth import router as auth_router
from routers.admin import router as admin_router
from routers import admin_foods

from routers.food_preferences import (
    router as food_preferences_router,
)

from routers.grocery_basket import (
    router as grocery_basket_router,
)

from routers.meal_plan import (
    router as meal_plan_router,
)

from routers.partner_shops import (
    router as partner_shops_router,
)

from routers.orders import (
    router as orders_router,
)

from routers.shop_owner_profile import (
    router as shop_owner_profile_router,
)

from routers.shop_owner_images import (
    router as shop_owner_images_router,
)

from routers.subscriptions import router as subscriptions_router
from routers.stripe_checkout import router as stripe_checkout_router
from routers.stripe_webhook import router as stripe_webhook_router
# ========================================
# FASTAPI APPLICATION
# ========================================

app = FastAPI(
    title="MealMate API",
    description=(
        "MealMate - Healthy Weekly Meal Planning "
        "and Grocery Basket Platform"
    ),
    version="1.0.0",
)


# ========================================
# CORS CONFIGURATION
# ========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://meal-mate-seven-ruddy.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# UPLOAD DIRECTORIES
# ========================================

BASE_DIR = Path(__file__).resolve().parent

UPLOAD_ROOT = BASE_DIR / "uploads"

PROFILE_PHOTO_DIR = (
    UPLOAD_ROOT / "profile_photos"
)

PROFILE_PHOTO_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ========================================
# STATIC FILES CONFIGURATION
# ========================================

app.mount(
    "/uploads",
    StaticFiles(
        directory=str(UPLOAD_ROOT)
    ),
    name="uploads",
)


# ========================================
# API ROUTERS
# ========================================

# Authentication
app.include_router(auth_router)

# Admin Dashboard, Customers, Orders,
# Shop Owner Management
app.include_router(admin_router)

# Admin Market Price Management
app.include_router(
    admin_market_prices.router
)

# Food Preferences
app.include_router(
    food_preferences_router
)

# Grocery Basket
app.include_router(
    grocery_basket_router
)

# Meal Plan
app.include_router(
    meal_plan_router
)

# Partner Shops
app.include_router(
    partner_shops_router
)

# Orders
app.include_router(
    orders_router
)

# Basket Synchronization
app.include_router(
    basket_sync.router
)

# Customer Profile
app.include_router(
    customer_profile.router
)

# Notifications
app.include_router(
    notifications.router
)

# Shop Owner Profile, Offers & Highlights
app.include_router(
    shop_owner_profile_router
)

# Shop Owner Images
app.include_router(
    shop_owner_images_router
)

# Subscription Management
app.include_router(subscriptions_router)
app.include_router(stripe_checkout_router)
app.include_router(stripe_webhook_router)

app.include_router(admin_foods.router)

# ========================================
# ROOT ENDPOINT
# ========================================

@app.get("/")
def root():
    return {
        "message": "Welcome to MealMate API",
        "status": "running",
    }


# ========================================
# HEALTH CHECK
# ========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "MealMate Backend",
    }


# ========================================
# ADDITIONAL ADMIN SWAGGER UI
# ========================================

@app.get(
    "/admin-api-docs",
    include_in_schema=False,
)
def admin_api_docs():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title="MealMate Admin API Documentation",
        swagger_ui_parameters={
            "filter": False,
            "docExpansion": "list",
        },
    )
