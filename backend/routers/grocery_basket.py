
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from groq import Groq
from pydantic import BaseModel, Field

from routers.auth import get_current_user
from services.grocery_basket_service import generate_grocery_basket


load_dotenv()

router = APIRouter(
    prefix="/grocery-basket",
    tags=["Grocery Basket"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
MEAL_PLAN_FILE = BASE_DIR / "sample_meal_plan.json"


# ==========================================
# AI PRICE REQUEST
# ==========================================

class GroceryPriceRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    quantity: float = Field(gt=0, le=10000)
    unit: str = Field(min_length=1, max_length=20)


UNIT_ALIASES = {
    "kg": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "l": "L",
    "liter": "L",
    "litre": "L",
    "liters": "L",
    "litres": "L",
    "ml": "ml",
    "piece": "pcs",
    "pieces": "pcs",
    "pc": "pcs",
    "pcs": "pcs",
    "bottle": "bottle",
    "bottles": "bottle",
    "dozen": "dozen",
    "bunch": "bunch",
}


# ==========================================
# AI PRICE ESTIMATION
# ==========================================

@router.post("/estimate-price")
def estimate_grocery_price(
    payload: GroceryPriceRequest,
    current_user=Depends(get_current_user),
):
    name = " ".join(payload.name.strip().split())
    unit = UNIT_ALIASES.get(payload.unit.strip().lower())

    if not unit:
        raise HTTPException(
            status_code=422,
            detail="Please select a valid grocery unit.",
        )

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured.",
        )

    try:
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model=os.getenv(
                "GROQ_MODEL",
                "openai/gpt-oss-20b",
            ),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a Sri Lankan grocery retail "
                        "price estimation assistant. "
                        "Estimate the retail price of the EXACT "
                        "grocery product requested by the user. "
                        "Consider the product type and unit. "
                        "Evaluate each product independently. "
                        "Never reuse a fixed default price. "
                        "The estimate must be for ONE unit, "
                        "not for the full requested quantity. "
                        "All prices must be in LKR. "
                        "These are estimates, not verified "
                        "live market prices. "
                        "Return ONLY a JSON object containing "
                        "estimated_unit_price_lkr as a positive "
                        "number. Return null if a reasonable "
                        "estimate cannot be made. "
                        "Do not include markdown or explanations."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "item_name": name,
                            "unit": unit,
                            "quantity": payload.quantity,
                            "country": "Sri Lanka",
                            "currency": "LKR",
                            "task": (
                                "Estimate the retail price for "
                                "one unit of this exact item."
                            ),
                        }
                    ),
                },
            ],
            temperature=0,
            max_tokens=250,
        )

        content = (
            response.choices[0].message.content or ""
        )

        # Debug output in backend terminal
        print(
            "GROQ PRICE RESPONSE:",
            name,
            unit,
            content,
        )

        # Extract JSON from AI response
        match = re.search(
            r"\{[\s\S]*?\}",
            content,
        )

        if not match:
            raise ValueError(
                "AI did not return a JSON price."
            )

        result = json.loads(match.group(0))

        raw_price = result.get(
            "estimated_unit_price_lkr"
        )

        if (
            isinstance(raw_price, bool)
            or not isinstance(raw_price, (int, float))
            or not 0 < raw_price < 10000000
        ):
            raise ValueError(
                "AI did not return a valid positive price."
            )

        unit_price = round(float(raw_price), 2)

        total_price = round(
            unit_price * payload.quantity,
            2,
        )

        return {
            "name": name,
            "quantity": payload.quantity,
            "unit": unit,
            "estimated_unit_price_lkr": unit_price,
            "estimated_total_price_lkr": total_price,
            "currency": "LKR",
            "price_source": "groq_ai_estimate",
            "price_note": (
                "AI-estimated Sri Lankan retail price. "
                "Not verified live market data."
            ),
        }

    except (ValueError, TypeError, KeyError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI price estimation failed: {error}",
        )

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="AI price service is unavailable. Try again.",
        ) from error


# ==========================================
# LEGACY SAMPLE GROCERY BASKET
# ==========================================

@router.get("/weekly")
def get_weekly_grocery_basket():

    # This is the SAMPLE endpoint.
    # The real AI basket uses:
    # GET /meal-plan/me/grocery-basket

    if not MEAL_PLAN_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Sample meal plan not found.",
        )

    try:
        with MEAL_PLAN_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:
            meal_plan = json.load(file)

        basket = generate_grocery_basket(
            meal_plan=meal_plan,
            weekly_budget=6000,
        )

        return basket

    except (
        ValueError,
        KeyError,
        TypeError,
        json.JSONDecodeError,
    ) as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )
