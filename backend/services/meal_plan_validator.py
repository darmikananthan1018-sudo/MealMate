
DAYS = [
    "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday"
]

MEAL_TYPES = ["breakfast", "lunch", "dinner"]


def validate_meal_plan(meal_plan, weekly_budget):
    errors = []
    total_cost = 0

    days = meal_plan.get("days")

    if not isinstance(days, list):
        return {
            "valid": False,
            "total_cost": 0,
            "weekly_budget": weekly_budget,
            "errors": ["Days must be a list."]
        }

    day_names = [
        day.get("day")
        for day in days
        if isinstance(day, dict)
    ]

    if len(days) != 7 or sorted(day_names) != sorted(DAYS):
        errors.append(
            "Meal plan must contain Monday to Sunday exactly once."
        )

    for day in days:
        if not isinstance(day, dict):
            errors.append("Invalid day data.")
            continue

        day_name = day.get("day", "Unknown")
        meals = day.get("meals")

        if not isinstance(meals, list):
            errors.append(f"{day_name}: Invalid meals list.")
            continue

        types = [
            meal.get("meal_type")
            for meal in meals
            if isinstance(meal, dict)
        ]

        if len(meals) != 3 or sorted(types) != sorted(MEAL_TYPES):
            errors.append(
                f"{day_name}: Must have breakfast, lunch and dinner."
            )

        for meal in meals:
            if not isinstance(meal, dict):
                errors.append(f"{day_name}: Invalid meal.")
                continue

            name = meal.get("name")
            if not isinstance(name, str) or not name.strip():
                errors.append(f"{day_name}: Missing meal name.")

            price = meal.get("estimated_price_lkr")
            if isinstance(price, bool) or not isinstance(
                price, (int, float)
            ) or price < 0:
                errors.append(
                    f"{day_name}: Invalid estimated price."
                )
            else:
                total_cost += price

            ingredients = meal.get("ingredients")
            if not isinstance(ingredients, list) or not ingredients:
                errors.append(
                    f"{day_name}: Missing ingredients."
                )
            else:
                for ingredient in ingredients:
                    if (
                        not isinstance(ingredient, dict)
                        or not ingredient.get("name")
                        or not ingredient.get("quantity")
                    ):
                        errors.append(
                            f"{day_name}: Invalid ingredient."
                        )

            nutrition = meal.get("nutrition")
            required = [
                "calories", "protein", "carbs",
                "fat", "fiber"
            ]

            if not isinstance(nutrition, dict):
                errors.append(
                    f"{day_name}: Missing nutrition data."
                )
            else:
                for nutrient in required:
                    value = nutrition.get(nutrient)
                    if (
                        isinstance(value, bool)
                        or not isinstance(value, (int, float))
                        or value < 0
                    ):
                        errors.append(
                            f"{day_name}: Invalid {nutrient}."
                        )

    if total_cost > weekly_budget:
        errors.append(
            f"Weekly budget exceeded by "
            f"Rs. {total_cost - weekly_budget:.2f}"
        )

    return {
        "valid": len(errors) == 0,
        "total_cost": total_cost,
        "weekly_budget": weekly_budget,
        "errors": errors
    }

