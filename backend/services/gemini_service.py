
import os
import json
import time
from decimal import Decimal, ROUND_HALF_UP

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError

load_dotenv()

DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

MEAL_TYPES = {"breakfast", "lunch", "dinner"}

NUTRITION_FIELDS = [
    "calories",
    "protein",
    "carbs",
    "fat",
    "fiber",
]


def to_money(value, field_name):
    if isinstance(value, bool):
        raise ValueError(f"Invalid {field_name}")

    try:
        amount = Decimal(str(value))
    except Exception as error:
        raise ValueError(
            f"Invalid {field_name}: {value}"
        ) from error

    if not amount.is_finite() or amount < 0:
        raise ValueError(f"Invalid {field_name}")

    return amount.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )


def validate_day_plan(day_plan, expected_day):
    if not isinstance(day_plan, dict):
        raise ValueError("Invalid AI response")

    if day_plan.get("day") != expected_day:
        raise ValueError(
            f"Incorrect day returned for {expected_day}"
        )

    meals = day_plan.get("meals")

    if not isinstance(meals, list) or len(meals) != 3:
        raise ValueError(
            f"{expected_day} must contain 3 meals"
        )

    meal_types = [
        meal.get("meal_type")
        for meal in meals
        if isinstance(meal, dict)
    ]

    if set(meal_types) != MEAL_TYPES or len(meal_types) != 3:
        raise ValueError(
            f"Invalid meal types for {expected_day}"
        )

    daily_cost = Decimal("0.00")

    for meal in meals:
        if not isinstance(meal.get("name"), str):
            raise ValueError("Missing meal name")

        if not meal["name"].strip():
            raise ValueError("Empty meal name")

        ingredients = meal.get("ingredients")

        if not isinstance(ingredients, list) or not ingredients:
            raise ValueError(
                f"Missing ingredients in {meal['name']}"
            )

        meal_cost = Decimal("0.00")

        for ingredient in ingredients:
            if not isinstance(ingredient, dict):
                raise ValueError("Invalid ingredient")

            name = ingredient.get("name")
            quantity = ingredient.get("quantity")
            unit = ingredient.get("unit")

            if not isinstance(name, str) or not name.strip():
                raise ValueError("Invalid ingredient name")

            if (
                isinstance(quantity, bool)
                or not isinstance(quantity, (int, float))
                or quantity <= 0
            ):
                raise ValueError(
                    f"Invalid quantity for {name}"
                )

            if not isinstance(unit, str) or not unit.strip():
                raise ValueError(
                    f"Invalid unit for {name}"
                )

            unit_price = to_money(
                ingredient.get("estimated_unit_price_lkr"),
                f"unit price for {name}"
            )

            ingredient_total = to_money(
                Decimal(str(quantity)) * unit_price,
                f"total price for {name}"
            )

            # Calculate price in Python instead of
            # trusting the AI's arithmetic.
            ingredient["estimated_unit_price_lkr"] = float(
                unit_price
            )

            ingredient["estimated_total_price_lkr"] = float(
                ingredient_total
            )

            meal_cost += ingredient_total

        nutrition = meal.get("nutrition")

        if not isinstance(nutrition, dict):
            raise ValueError("Missing nutrition details")

        for field in NUTRITION_FIELDS:
            value = nutrition.get(field)

            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value < 0
            ):
                raise ValueError(
                    f"Invalid nutrition field: {field}"
                )

        meal_cost = to_money(
            meal_cost,
            "meal cost"
        )

        meal["estimated_price_lkr"] = float(meal_cost)

        daily_cost += meal_cost

    return daily_cost


def generate_weekly_meal_plan(preferences: dict):

    api_key = os.getenv("GEMINI_API_KEY")

    model_name = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash-lite"
    )

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY missing")

    client = genai.Client(
        api_key=api_key,
        http_options={"timeout": 60000}
    )

    weekly_budget = to_money(
        preferences.get("weekly_budget", 0),
        "weekly budget"
    )

    family_members = int(
        preferences.get("family_members", 1)
    )

    if weekly_budget <= 0:
        raise ValueError("Weekly budget must be positive")

    if family_members < 1:
        raise ValueError(
            "Family members must be at least 1"
        )

    weekly_plan = {"days": []}

    total_estimated_cost = Decimal("0.00")

    for day_index, day in enumerate(DAYS):

        print(f"Generating {day} meal plan...")

        remaining_days = len(DAYS) - day_index

        remaining_budget = (
            weekly_budget - total_estimated_cost
        )

        suggested_daily_budget = (
            remaining_budget / remaining_days
        )

        prompt = f"""
You are the AI meal planning assistant for MealMate,
a Sri Lankan weekly meal planning application.

Generate a meal plan for {day} only.

CUSTOMER PREFERENCES:
{json.dumps(preferences, ensure_ascii=False, default=str)}

FAMILY DETAILS:
- Family members: {family_members}
- Weekly budget: LKR {weekly_budget}
- Remaining weekly budget: LKR {remaining_budget:.2f}
- Remaining days: {remaining_days}
- Suggested daily budget: LKR {suggested_daily_budget:.2f}

MEAL REQUIREMENTS:
1. Generate exactly breakfast, lunch and dinner.
2. Prefer affordable Sri Lankan meals.
3. Respect vegetarian/nonvegetarian preferences.
4. Avoid disliked foods and respect stated allergies.
5. Consider health conditions cautiously.
6. Include ingredients for the entire family.
7. Include estimated nutrition for the entire family.
8. Include calories, protein, carbs, fat and fiber.
9. Use realistic portions and sufficient food variety.

AI INGREDIENT PRICE REQUIREMENTS:
1. Estimate Sri Lankan ingredient prices in LKR.
2. These are AI estimates, NOT verified live market prices.
3. Each ingredient must include:
   - name
   - quantity (positive number)
   - unit
   - estimated_unit_price_lkr
4. The unit price must be for exactly one specified unit.
5. Example:
   0.5 kg rice at LKR 250 per kg costs LKR 125.
6. Use consistent units:
   kg, g, litre, ml, piece, bunch.
7. For example, if quantity is 500 and unit is g,
   price must be per g, not per kg.
8. Do not invent artificially low prices to fit budget.
9. Reuse ingredients where practical to reduce waste.
10. Do not reduce reasonable portions just to fit budget.
11. If budget is insufficient, allow realistic over-budget
    estimates rather than claiming affordability.

BUDGET:
Try to keep today's cost near
LKR {suggested_daily_budget:.2f}
when realistically feasible.

RETURN VALID JSON ONLY:

{{
  "day": "{day}",
  "meals": [
    {{
      "meal_type": "breakfast",
      "name": "Example Sri Lankan Meal",
      "ingredients": [
        {{
          "name": "Red Rice",
          "quantity": 0.5,
          "unit": "kg",
          "estimated_unit_price_lkr": 250
        }},
        {{
          "name": "Coconut",
          "quantity": 1,
          "unit": "piece",
          "estimated_unit_price_lkr": 180
        }}
      ],
      "estimated_price_lkr": 305,
      "nutrition": {{
        "calories": 1200,
        "protein": 30,
        "carbs": 180,
        "fat": 35,
        "fiber": 20
      }}
    }}
  ]
}}

IMPORTANT:
- Return exactly three meal objects.
- Meal types: breakfast, lunch, dinner.
- All ingredient quantities must cover the family.
- Nutrition values must cover the family.
- All prices must be estimated in LKR.
- Return JSON only.
"""

        for attempt in range(3):

            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )

                if not response.text:
                    raise RuntimeError(
                        f"Empty response for {day}"
                    )

                day_plan = json.loads(response.text)

                daily_cost = validate_day_plan(
                    day_plan,
                    day
                )

                total_estimated_cost += daily_cost

                weekly_plan["days"].append(day_plan)

                print(
                    f"{day} completed! "
                    f"Estimated cost: Rs. {daily_cost:.2f}"
                )

                break

            except ServerError as error:

                if error.code != 503:
                    raise

                if attempt == 2:
                    raise RuntimeError(
                        f"Gemini busy while generating {day}"
                    ) from error

                wait_seconds = 5 * (2 ** attempt)

                print(
                    f"Server busy. Waiting "
                    f"{wait_seconds} seconds..."
                )

                time.sleep(wait_seconds)

    if len(weekly_plan["days"]) != 7:
        raise RuntimeError(
            "Incomplete weekly meal plan"
        )

    print("\nWeekly Meal Plan Generated!")

    print(
        f"Weekly Budget: Rs. {weekly_budget:.2f}"
    )

    print(
        f"Estimated Total: Rs. "
        f"{total_estimated_cost:.2f}"
    )

    if total_estimated_cost > weekly_budget:
        print(
            "Warning: Weekly budget exceeded by "
            f"Rs. {total_estimated_cost - weekly_budget:.2f}"
        )
    else:
        print("Estimated total is within budget.")

    return weekly_plan

