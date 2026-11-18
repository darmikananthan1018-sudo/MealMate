
import json
from services.meal_plan_validator import validate_meal_plan

# Load AI-generated weekly meal plan
with open("sample_meal_plan.json", "r", encoding="utf-8") as file:
    meal_plan = json.load(file)

# Customer weekly budget
weekly_budget = 6000

# Validate the meal plan
result = validate_meal_plan(meal_plan, weekly_budget)

print("\nMealMate Weekly Meal Plan Validation")
print("-----------------------------------")

print("Valid:", result["valid"])
print("Weekly Budget: Rs.", result["weekly_budget"])
print("Estimated Total Cost: Rs.", result["total_cost"])

print("\nValidation Errors:")

if result["errors"]:
    for error in result["errors"]:
        print("-", error)
else:
    print("No validation errors!")
