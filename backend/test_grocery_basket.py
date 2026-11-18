
import json
from pathlib import Path

from services.grocery_basket_service import generate_grocery_basket


BASE_DIR = Path(__file__).resolve().parent

MEAL_PLAN_FILE = BASE_DIR / "sample_meal_plan.json"

OUTPUT_FILE = BASE_DIR / "sample_grocery_basket.json"


# Customer's weekly budget
WEEKLY_BUDGET = 6000


def main():
    print("=" * 55)
    print("MealMate - Weekly Grocery Basket Generator")
    print("=" * 55)

    if not MEAL_PLAN_FILE.exists():
        print("Error: sample_meal_plan.json not found!")
        print(f"Expected location: {MEAL_PLAN_FILE}")
        return

    try:
        # Step 1: Load generated meal plan
        with MEAL_PLAN_FILE.open(
            "r",
            encoding="utf-8"
        ) as file:
            meal_plan = json.load(file)

        print("\nMeal plan loaded successfully!")

        # Step 2: Generate weekly grocery basket
        basket = generate_grocery_basket(
            meal_plan=meal_plan,
            weekly_budget=WEEKLY_BUDGET,
        )

        print("\nWeekly Grocery Basket")
        print("-" * 55)

        # Step 3: Display each ingredient
        for index, item in enumerate(
            basket["items"],
            start=1
        ):
            print(
                f"{index}. {item['name']} "
                f"- {item['quantity']:g} {item['unit']} "
                f"- Rs. {item['estimated_total_price_lkr']:.2f}"
            )

        # Step 4: Display total
        print("\n" + "=" * 55)

        print(
            f"Unique Ingredients: "
            f"{basket['total_unique_items']}"
        )

        print(
            f"Estimated Basket Total: "
            f"Rs. {basket['estimated_total_lkr']:.2f}"
        )

        print(
            f"Weekly Budget: "
            f"Rs. {basket['weekly_budget_lkr']:.2f}"
        )

        if basket["within_budget"]:
            print("\nStatus: Within Budget")

            print(
                f"Remaining Budget: "
                f"Rs. {basket['remaining_budget_lkr']:.2f}"
            )
        else:
            print("\nStatus: Over Budget")

            print(
                f"Exceeded Amount: "
                f"Rs. {basket['over_budget_lkr']:.2f}"
            )

        # Step 5: Save basket to JSON
        with OUTPUT_FILE.open(
            "w",
            encoding="utf-8"
        ) as file:
            json.dump(
                basket,
                file,
                indent=2,
                ensure_ascii=False,
            )

        print("\nGrocery Basket Generated Successfully!")

        print(f"Saved to: {OUTPUT_FILE}")

    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"\nGrocery Basket Generation Failed: {error}")
        raise


if __name__ == "__main__":
    main()
