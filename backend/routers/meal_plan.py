
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.food_preferences import FoodPreferences
from models.meal_plan import MealPlan
from models.grocery_basket import GroceryBasket

from routers.auth import get_current_user
from services.groq_service import generate_weekly_meal_plan
from services.grocery_basket_service import generate_grocery_basket


router = APIRouter(
    prefix="/meal-plan",
    tags=["AI Meal Plan"],
)


def get_customer(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Only customers can access meal plans.",
        )

    return current_user


def validate_budget(grocery_basket_data, weekly_budget):
    """
    Validate grocery basket estimated total against
    the customer's weekly budget.
    """

    try:
        budget = Decimal(str(weekly_budget))

        basket_total = Decimal(
            str(grocery_basket_data["estimated_total_lkr"])
        )

    except (InvalidOperation, ValueError, TypeError, KeyError) as error:
        raise ValueError(
            "Invalid grocery basket total or weekly budget."
        ) from error

    if not budget.is_finite() or budget <= 0:
        raise ValueError("Weekly budget must be positive.")

    if not basket_total.is_finite() or basket_total < 0:
        raise ValueError("Invalid grocery basket estimated cost.")

    if basket_total > budget:
        exceeded_amount = basket_total - budget

        raise ValueError(
            f"Your grocery basket estimated cost is "
            f"Rs. {basket_total:.2f}, but your weekly budget "
            f"is Rs. {budget:.2f}. "
            f"Budget exceeded by Rs. {exceeded_amount:.2f}. "
            "Please increase your budget or generate "
            "a more affordable meal plan."
        )

    return basket_total


@router.post(
    "/generate",
    status_code=status.HTTP_201_CREATED,
)
def create_weekly_meal_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_customer),
):

    # 1. Get logged-in customer's food preferences

    preferences = (
        db.query(FoodPreferences)
        .filter(
            FoodPreferences.user_id == current_user.id
        )
        .first()
    )

    if not preferences:
        raise HTTPException(
            status_code=404,
            detail="Please save your food preferences first.",
        )

    # 2. Prepare preferences for Groq AI
    # Include the customer's selected Meal Plan Start Day

    preferences_data = {
        "family_members": preferences.family_members,
        "weekly_budget": float(preferences.weekly_budget),
        "diet_type": preferences.diet_type,
        "start_day": preferences.start_day or "Today",
        "health_conditions": preferences.health_conditions or [],
        "preferred_foods": preferences.preferred_foods or [],
        "disliked_foods": preferences.disliked_foods or [],
    }

    # 3. Generate AI meal plan and grocery basket

    try:
        meal_plan_data = generate_weekly_meal_plan(
            preferences_data
        )

        grocery_basket_data = generate_grocery_basket(
            meal_plan=meal_plan_data,
            weekly_budget=preferences.weekly_budget,
        )

        # 4. Validate weekly budget before saving

        basket_total = validate_budget(
            grocery_basket_data=grocery_basket_data,
            weekly_budget=preferences.weekly_budget,
        )

    except (ValueError, TypeError, KeyError) as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI meal plan generation is currently "
                "unavailable. Please try again later."
            ),
        ) from error

    # 5. Save meal plan and grocery basket together

    try:
        new_meal_plan = MealPlan(
            user_id=current_user.id,
            plan_data=meal_plan_data,
            weekly_budget=preferences.weekly_budget,
            status="generated",
        )

        db.add(new_meal_plan)
        db.flush()

        new_basket = GroceryBasket(
            user_id=current_user.id,
            meal_plan_id=new_meal_plan.id,
            basket_data=grocery_basket_data,
            estimated_total_lkr=basket_total,
        )

        db.add(new_basket)

        # Save both records in one transaction
        db.commit()

        db.refresh(new_meal_plan)
        db.refresh(new_basket)

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save meal plan "
                "and grocery basket."
            ),
        ) from error

    return {
        "message": "Weekly meal plan generated successfully",
        "meal_plan_id": new_meal_plan.id,
        "grocery_basket_id": new_basket.id,
        "meal_plan": new_meal_plan.plan_data,
        "grocery_basket": new_basket.basket_data,
    }


@router.get("/me")
def get_my_latest_meal_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_customer),
):

    meal_plan = (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == current_user.id
        )
        .order_by(MealPlan.id.desc())
        .first()
    )

    if not meal_plan:
        raise HTTPException(
            status_code=404,
            detail="No meal plan found. Generate one first.",
        )

    return {
        "id": meal_plan.id,
        "weekly_budget": meal_plan.weekly_budget,
        "status": meal_plan.status,
        "created_at": meal_plan.created_at,
        "meal_plan": meal_plan.plan_data,
    }


@router.get("/me/grocery-basket")
def get_my_latest_grocery_basket(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_customer),
):

    basket = (
        db.query(GroceryBasket)
        .filter(
            GroceryBasket.user_id == current_user.id
        )
        .order_by(GroceryBasket.id.desc())
        .first()
    )

    if not basket:
        raise HTTPException(
            status_code=404,
            detail=(
                "No grocery basket found. "
                "Generate a meal plan first."
            ),
        )

    return {
        "id": basket.id,
        "meal_plan_id": basket.meal_plan_id,
        "estimated_total_lkr": basket.estimated_total_lkr,
        "created_at": basket.created_at,
        "grocery_basket": basket.basket_data,
    }
