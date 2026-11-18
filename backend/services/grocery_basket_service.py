
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


MONEY = Decimal("0.01")

UNIT_ALIASES = {
    "kg": ("kg", Decimal("1")),
    "kilogram": ("kg", Decimal("1")),
    "kilograms": ("kg", Decimal("1")),
    "g": ("kg", Decimal("0.001")),
    "gram": ("kg", Decimal("0.001")),
    "grams": ("kg", Decimal("0.001")),

    "litre": ("litre", Decimal("1")),
    "liter": ("litre", Decimal("1")),
    "litres": ("litre", Decimal("1")),
    "liters": ("litre", Decimal("1")),
    "l": ("litre", Decimal("1")),
    "ml": ("litre", Decimal("0.001")),
    "millilitre": ("litre", Decimal("0.001")),
    "milliliter": ("litre", Decimal("0.001")),

    "piece": ("piece", Decimal("1")),
    "pieces": ("piece", Decimal("1")),
    "pcs": ("piece", Decimal("1")),
    "pc": ("piece", Decimal("1")),
    "dozen": ("piece", Decimal("12")),
    "dozens": ("piece", Decimal("12")),

    "bunch": ("bunch", Decimal("1")),
    "bunches": ("bunch", Decimal("1")),
}


# ==========================================
# INGREDIENT NAME NORMALIZATION
# ==========================================

INGREDIENT_ALIASES = {
    "red onions": "red onion",
    "red onion": "red onion",
    "big onions": "big onion",
    "big onion": "big onion",

    "tomatoes": "tomato",
    "tomato": "tomato",

    "potatoes": "potato",
    "potato": "potato",

    "carrots": "carrot",
    "carrot": "carrot",

    "bananas": "banana",
    "banana": "banana",

    "eggs": "egg",
    "egg": "egg",

    "green chillies": "green chilli",
    "green chili": "green chilli",
    "green chilies": "green chilli",
    "green chilli": "green chilli",

    "lentils": "lentil",
    "lentil": "lentil",

    "dhal": "dhal",
    "dal": "dhal",
    "dhall": "dhal",

    "milk": "milk",
    "rice": "rice",
}


def normalize_ingredient_name(name):
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Invalid ingredient name")

    cleaned = re.sub(
        r"\s+",
        " ",
        name.strip().lower(),
    )

    cleaned = re.sub(
        r"[^\w\s-]",
        "",
        cleaned,
    )

    return INGREDIENT_ALIASES.get(cleaned, cleaned)


def display_ingredient_name(name):
    return " ".join(
        word.capitalize()
        for word in name.split()
    )


# ==========================================
# DECIMAL HELPERS
# ==========================================

def decimal_value(value, field_name):
    if isinstance(value, bool):
        raise ValueError(f"Invalid {field_name}")

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(
            f"Invalid {field_name}: {value}"
        )

    if not number.is_finite():
        raise ValueError(
            f"Invalid {field_name}"
        )

    return number


def money(value):
    return value.quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )


# ==========================================
# UNIT NORMALIZATION
# ==========================================

def normalize_unit(quantity, unit, unit_price):
    if not isinstance(unit, str):
        raise ValueError("Invalid ingredient unit")

    unit_key = unit.strip().lower()

    if unit_key not in UNIT_ALIASES:
        raise ValueError(
            f"Unsupported unit: {unit}"
        )

    normalized_unit, factor = UNIT_ALIASES[unit_key]

    normalized_quantity = quantity * factor
    normalized_unit_price = unit_price / factor

    return (
        normalized_quantity,
        normalized_unit,
        normalized_unit_price,
    )


# ==========================================
# GENERATE GROCERY BASKET
# ==========================================

def generate_grocery_basket(
    meal_plan,
    weekly_budget=None,
):
    """
    Generate one grocery basket from a 7-day
    AI-generated meal plan.

    Duplicate ingredient names and compatible
    measurement units are merged.

    Prices are AI estimates from the meal plan,
    not verified live market prices.
    """

    if not isinstance(meal_plan, dict):
        raise ValueError(
            "Meal plan must be a dictionary"
        )

    days = meal_plan.get("days")

    if not isinstance(days, list) or len(days) != 7:
        raise ValueError(
            "Meal plan must contain exactly 7 days"
        )

    basket_items = {}

    for day in days:
        if not isinstance(day, dict):
            raise ValueError("Invalid day entry")

        day_name = day.get("day", "Unknown")
        meals = day.get("meals", [])

        if not isinstance(meals, list) or len(meals) != 3:
            raise ValueError(
                f"{day_name} must contain exactly 3 meals"
            )

        for meal in meals:
            if not isinstance(meal, dict):
                raise ValueError(
                    f"Invalid meal in {day_name}"
                )

            ingredients = meal.get(
                "ingredients",
                [],
            )

            if (
                not isinstance(ingredients, list)
                or not ingredients
            ):
                raise ValueError(
                    f"Missing ingredients in {day_name}"
                )

            for ingredient in ingredients:
                if not isinstance(ingredient, dict):
                    raise ValueError(
                        "Invalid ingredient entry"
                    )

                original_name = ingredient.get("name")
                original_unit = ingredient.get("unit")

                name = normalize_ingredient_name(
                    original_name
                )

                quantity = decimal_value(
                    ingredient.get("quantity"),
                    f"quantity for {name}",
                )

                unit_price = decimal_value(
                    ingredient.get(
                        "estimated_unit_price_lkr"
                    ),
                    f"unit price for {name}",
                )

                if quantity <= 0:
                    raise ValueError(
                        f"Quantity must be positive for {name}"
                    )

                if unit_price < 0:
                    raise ValueError(
                        f"Price cannot be negative for {name}"
                    )

                (
                    normalized_quantity,
                    normalized_unit,
                    normalized_unit_price,
                ) = normalize_unit(
                    quantity,
                    original_unit,
                    unit_price,
                )

                item_cost = money(
                    quantity * unit_price
                )

                # Merge by normalized name + unit
                item_key = (
                    name,
                    normalized_unit,
                )

                if item_key not in basket_items:
                    basket_items[item_key] = {
                        "name": display_ingredient_name(name),
                        "quantity": Decimal("0"),
                        "unit": normalized_unit,
                        "estimated_total": Decimal("0"),
                        "days_used": set(),
                    }

                item = basket_items[item_key]

                item["quantity"] += normalized_quantity
                item["estimated_total"] += item_cost
                item["days_used"].add(day_name)

    # ======================================
    # BUILD FINAL ITEM LIST
    # ======================================

    items = []

    for item in basket_items.values():
        quantity = item["quantity"]
        total = money(item["estimated_total"])

        if quantity <= 0:
            continue

        average_unit_price = money(
            total / quantity
        )

        items.append({
            "name": item["name"],
            "quantity": float(quantity),
            "unit": item["unit"],
            "estimated_unit_price_lkr": float(
                average_unit_price
            ),
            "estimated_total_price_lkr": float(total),
            "days_used": sorted(
                item["days_used"]
            ),
        })

    items.sort(
        key=lambda item: item["name"].lower()
    )

    # ======================================
    # CALCULATE BASKET TOTAL
    # ======================================

    basket_total = money(
        sum(
            (
                Decimal(
                    str(
                        item[
                            "estimated_total_price_lkr"
                        ]
                    )
                )
                for item in items
            ),
            Decimal("0"),
        )
    )

    result = {
        "basket_type": "weekly",
        "total_days": 7,
        "total_unique_items": len(items),
        "items": items,
        "estimated_total_lkr": float(
            basket_total
        ),
        "price_note": (
            "AI-estimated ingredient prices. "
            "Not verified live market prices."
        ),
    }

    # ======================================
    # WEEKLY BUDGET
    # ======================================

    if weekly_budget is not None:
        budget = decimal_value(
            weekly_budget,
            "weekly budget",
        )

        if budget <= 0:
            raise ValueError(
                "Weekly budget must be positive"
            )

        difference = money(
            budget - basket_total
        )

        result["weekly_budget_lkr"] = float(
            money(budget)
        )

        result["within_budget"] = (
            basket_total <= budget
        )

        result["remaining_budget_lkr"] = float(
            max(
                difference,
                Decimal("0"),
            )
        )

        result["over_budget_lkr"] = float(
            max(
                -difference,
                Decimal("0"),
            )
        )

    return result
