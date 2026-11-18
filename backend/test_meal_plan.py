
import json
from pathlib import Path

from services.groq_service import generate_weekly_meal_plan


# MealMate Customer Preferences
preferences = {
    "family_members": 5,
    "weekly_budget": 6000,
    "diet_type": "vegetarian",
    "health_conditions": ["low sugar"],
    "preferred_foods": [
        "Rice",
        "Dhal",
        "Carrot",
        "Banana"
    ],
    "disliked_foods": [
        "Bitter Gourd"
    ]
}


def main():
    print("Generating MealMate Weekly Meal Plan...")

    try:
        # Generate or resume the weekly meal plan
        meal_plan = generate_weekly_meal_plan(preferences)

        # Display the result
        print(
            json.dumps(
                meal_plan,
                indent=2,
                ensure_ascii=False
            )
        )

        # Save the completed weekly meal plan
        output_file = Path(__file__).resolve().parent / "sample_meal_plan.json"

        with output_file.open("w", encoding="utf-8") as file:
            json.dump(
                meal_plan,
                file,
                indent=2,
                ensure_ascii=False
            )

        print("\nMeal plan generated successfully!")
        print(f"Meal plan saved to {output_file}")

    except Exception as error:
        print("\nMeal Plan Generation Failed!")
        print(f"Error: {error}")
        print(
            "Check the error above. "
            "If your groq_service.py supports checkpoints, "
            "saved days can be resumed on the next run."
        )
        raise


if __name__ == "__main__":
    main()

