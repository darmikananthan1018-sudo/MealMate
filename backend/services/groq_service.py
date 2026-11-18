import os
import json
import time
import hashlib
import random
from pathlib import Path
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from groq import Groq, APIStatusError, APIConnectionError, APITimeoutError

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
def get_week_days(start_day="Today", start_date=None):
    """Return seven weekdays starting from the customer's selected day."""
    if start_date is None:
        start_date = datetime.now(ZoneInfo("Asia/Colombo")).date()

    if start_day == "Today":
        start_index = start_date.weekday()
    elif start_day in DAYS:
        start_index = DAYS.index(start_day)
    else:
        raise ValueError("Invalid meal plan start day")

    return DAYS[start_index:] + DAYS[:start_index]
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


def checkpoint_path(preferences, start_date):
    payload = json.dumps(
        {
            "budget_policy": "v3_strict_daily_cap_rolling_week",
            "preferences": preferences,
            "start_date": start_date.isoformat(),
        },
        sort_keys=True, default=str, ensure_ascii=False,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return Path(__file__).resolve().parent.parent / f"meal_plan_progress_{digest}.json"


def save_progress(path, plan):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    temp.replace(path)


def retry_wait(error, attempt):
    """Respect provider retry hints and avoid rapid repeated requests."""
    if isinstance(error, APIStatusError) and error.status_code == 429:
        headers = error.response.headers
        for key in ("retry-after",):
            value = headers.get(key)
            if value:
                try:
                    return max(1, min(180, float(value) + 2))
                except ValueError:
                    try:
                        when = parsedate_to_datetime(value)
                        return max(1, min(180, (when - datetime.now(timezone.utc)).total_seconds() + 2))
                    except (TypeError, ValueError):
                        pass
        # A longer backoff is preferable to exhausting a tokens-per-minute limit.
        return min(180, 65 * (attempt + 1)) + random.uniform(0, 3)
    return min(45, 4 * (2 ** attempt)) + random.uniform(0, 2)


def validate_price_sanity(day_plan, daily_cost, weekly_budget):
    # Heuristic guard only: this is NOT verification against real market prices.
    # Large outliers are rejected rather than silently adjusted.
    ceiling = max(Decimal("15000"), weekly_budget * Decimal("3"))
    if daily_cost > ceiling:
        raise ValueError(
            f"Suspicious daily price Rs. {daily_cost:.2f}; "
            "check ingredient units and per-unit prices"
        )
    for meal in day_plan["meals"]:
        for item in meal["ingredients"]:
            unit = item["unit"].strip().lower()
            price = Decimal(str(item["estimated_unit_price_lkr"]))
            if unit in ("g", "ml") and price > Decimal("100"):
                raise ValueError(
                    f"Suspicious price per {unit} for {item['name']}: {price}"
                )


def generate_weekly_meal_plan(preferences: dict):
    # Freeze the start date once, even if generation crosses midnight.
    start_date = datetime.now(ZoneInfo("Asia/Colombo")).date()
    selected_start_day = preferences.get("start_day", "Today") or "Today"
    days = get_week_days(selected_start_day, start_date)

    api_key = os.getenv("GROQ_API_KEY")

    model_name = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-20b"
    )

    if not api_key:
        raise RuntimeError("GROQ_API_KEY missing")

    client = Groq(api_key=api_key, timeout=90.0, max_retries=0)

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

    progress_file = checkpoint_path(preferences, start_date)
    weekly_plan = {"days": []}
    total_estimated_cost = Decimal("0.00")
    if progress_file.exists():
        saved = json.loads(progress_file.read_text(encoding="utf-8"))
        if not isinstance(saved, dict) or not isinstance(saved.get("days"), list):
            raise ValueError("Invalid saved progress file")
        for index, saved_day in enumerate(saved["days"]):
            if index >= len(days):
                raise ValueError("Too many saved days")
            cost = validate_day_plan(saved_day, days[index])
            validate_price_sanity(saved_day, cost, weekly_budget)
            # Do not resume checkpoints that exceed the per-day allowance.
            allowance = (weekly_budget - total_estimated_cost) / Decimal(len(days) - index)
            if cost > allowance:
                raise ValueError("Saved progress exceeds the daily budget allowance")
            total_estimated_cost += cost
            weekly_plan["days"].append(saved_day)
        print(f"Resuming from {len(weekly_plan['days'])} saved day(s).")

    for day_index, day in enumerate(days):

        if day_index < len(weekly_plan["days"]):
            continue

        print(f"Generating {day} meal plan...")

        remaining_days = len(days) - day_index

        remaining_budget = (
            weekly_budget - total_estimated_cost
        )

        suggested_daily_budget = (
            remaining_budget / remaining_days
        )

        if suggested_daily_budget <= 0:
            raise ValueError("No budget remains for the remaining days")

        # Keep the response concise; the model must still return every ingredient.
        prompt = f"""Return ONE compact JSON object for {day}, with 3 Sri Lankan family meals.
Preferences: {json.dumps(preferences, ensure_ascii=False, default=str, separators=(',', ':'))}
People: {family_members}. Weekly budget LKR {weekly_budget}.
Remaining LKR {remaining_budget:.2f}; STRICT maximum total for all three meals today LKR {suggested_daily_budget:.2f}.
Select affordable dishes and reuse staple ingredients where appropriate. If a realistic healthy day cannot fit, do not falsify prices or portions.
Respect dietary restrictions, allergies, disliked foods, and health preferences.
Use realistic local portions and estimated prices; never fake low prices to fit budget.
Quantities and approximate nutrition are for the WHOLE FAMILY.
For each meal include all necessary ingredients, but use concise names.
Units ONLY: kg, litre, piece, bunch. Prices in LKR per stated unit.
Use exactly this schema, no additional keys or markdown:
{{"day":"{day}","meals":[
{{"meal_type":"breakfast","name":"...","ingredients":[{{"name":"...","quantity":0.5,"unit":"kg","estimated_unit_price_lkr":250}}],"nutrition":{{"calories":1200,"protein":30,"carbs":180,"fat":35,"fiber":20}}}},
{{"meal_type":"lunch","name":"...","ingredients":[{{"name":"...","quantity":0.3,"unit":"kg","estimated_unit_price_lkr":400}}],"nutrition":{{"calories":1100,"protein":40,"carbs":150,"fat":20,"fiber":25}}}},
{{"meal_type":"dinner","name":"...","ingredients":[{{"name":"...","quantity":0.4,"unit":"kg","estimated_unit_price_lkr":300}}],"nutrition":{{"calories":900,"protein":25,"carbs":120,"fat":15,"fiber":15}}}}]}}
Do not output meal totals; Python calculates them. Estimates are not live market data.
"""

        # Completion tokens can include the model's internal reasoning tokens.
        max_tokens = int(os.getenv("GROQ_MAX_COMPLETION_TOKENS", "6000"))
        max_tokens = max(1000, min(max_tokens, 8192))

        for attempt in range(4):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "Output only a compact complete JSON object. No explanation or markdown. No reasoning in output."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_completion_tokens=max_tokens,
                )
                choice = response.choices[0]
                content = choice.message.content
                if choice.finish_reason == "length":
                    raise ValueError(f"Incomplete output for {day}: token limit reached")
                if not content:
                    raise ValueError(f"Empty response for {day}")

                # Handle an optional Markdown JSON code fence.
                content = content.strip()
                if content.startswith("```"):
                    lines = content.splitlines()
                    if lines and lines[-1].strip() == "```":
                        content = "\n".join(lines[1:-1]).strip()
                day_plan = json.loads(content)
                daily_cost = validate_day_plan(day_plan, day)
                validate_price_sanity(day_plan, daily_cost, weekly_budget)
                if daily_cost > suggested_daily_budget:
                    raise ValueError(
                        f"{day} estimated cost Rs. {daily_cost:.2f} exceeds "
                        f"daily allowance Rs. {suggested_daily_budget:.2f}; "
                        "choose genuinely cheaper meals and ingredients"
                    )
                total_estimated_cost += daily_cost
                weekly_plan["days"].append(day_plan)
                save_progress(progress_file, weekly_plan)
                print(f"{day} completed! Estimated cost: Rs. {daily_cost:.2f}")
                break

            except (APIStatusError, APIConnectionError, APITimeoutError,
                    ValueError, json.JSONDecodeError) as error:
                # Retry temporary API failures or malformed model output.
                if isinstance(error, APIStatusError):
                    # Retry only the JSON validation 400 error, not all 400s.
                    error_code = ""
                    try:
                        error_code = error.response.json().get("error", {}).get("code", "")
                    except (ValueError, AttributeError):
                        pass
                    retryable = error.status_code in (429, 500, 502, 503, 504) or (
                        error.status_code == 400 and error_code == "json_validate_failed"
                    )
                    if not retryable:
                        raise
                if attempt == 3:
                    raise RuntimeError(
                        f"Could not produce a valid budget-aware {day} meal plan: {error}"
                    ) from error
                wait_seconds = retry_wait(error, attempt)
                print(f"{day} attempt {attempt + 1} failed: {type(error).__name__}: {str(error)[:180]}")
                print(f"Retrying {day} in {wait_seconds} seconds...")
                time.sleep(wait_seconds)

    if len(weekly_plan["days"]) != len(days):
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
        raise ValueError("Generated plan exceeds the weekly budget")
    print("Estimated total is within budget.")

    return weekly_plan