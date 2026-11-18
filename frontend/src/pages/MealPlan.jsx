

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf,
  Sparkles,
  Wallet,
  Users,
  X,
  Heart,
  RefreshCw,
  ShoppingBasket,
  Flame,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import "../styles/CustomerDashboard.css";
import { getMyMealPlan, getMyGroceryBasket, getMyFoodPreferences, generateWeeklyMealPlan } from "../services/api";

const FALLBACK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const GOALS = {
  calories: 2000,
  protein: 60,
  carbs: 275,
  fats: 65,
  fiber: 28,
};

const METRICS = [
  ["calories", "Calories", "kcal"],
  ["protein", "Protein", "g"],
  ["carbs", "Carbs", "g"],
  ["fats", "Fats", "g"],
  ["fiber", "Fiber", "g"],
];

// The UI receives real customer-specific meals from FastAPI.
const IMAGE_BY_TYPE = {
  Breakfast: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=900&auto=format&fit=crop",
  Lunch: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900&auto=format&fit=crop",
  Dinner: "https://images.unsplash.com/photo-1547592180-85f173990554?w=900&auto=format&fit=crop",
};

function normalizeMeal(meal, day, index) {
  const type = String(meal.meal_type || "").toLowerCase();
  const displayType = type === "breakfast" ? "Breakfast" : type === "lunch" ? "Lunch" : "Dinner";
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const nutrition = meal.nutrition || {};
  return {
    id: `${day}-${displayType}-${index}-${meal.name || "meal"}`,
    type: displayType,
    name: meal.name || "Unnamed meal",
    image: meal.image_url || IMAGE_BY_TYPE[displayType],
    nutrition: {
      calories: Number(nutrition.calories) || 0,
      protein: Number(nutrition.protein) || 0,
      carbs: Number(nutrition.carbs) || 0,
      fats: Number(nutrition.fats ?? nutrition.fat) || 0,
      fiber: Number(nutrition.fiber) || 0,
    },
    ingredients: ingredients.map((item) => [
      item.name || "Ingredient",
      `${item.quantity ?? 0} ${item.unit || ""}`.trim(),
      Number(item.estimated_total_price_lkr) || 0,
    ]),
  };
}

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

const priceOf = (meal) =>
  meal.ingredients.reduce((sum, [, , price]) => sum + price, 0);

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function readPreferences() {
  const defaults = {
    familyMembers: 4,
    weeklyBudget: 5000,
    dietType: "Vegetarian",
    healthNeeds: [],
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem("mealmate_food_preferences") || "{}"
    );

    const members = Number(saved.familyMembers);
    const budget = Number(saved.weeklyBudget);

    return {
      familyMembers:
        Number.isFinite(members) && members > 0
          ? Math.floor(members)
          : defaults.familyMembers,
      weeklyBudget:
        Number.isFinite(budget) && budget >= 0 &&
        saved.weeklyBudget !== undefined &&
        saved.weeklyBudget !== ""
          ? budget
          : defaults.weeklyBudget,
      dietType: saved.dietType || defaults.dietType,
      healthNeeds: Array.isArray(saved.healthNeeds)
        ? saved.healthNeeds
        : [],
    };
  } catch {
    return defaults;
  }
}

function MealImage({ meal, className = "" }) {
  const [failed, setFailed] = useState(false);

  return failed ? (
    <div className={`mp-ref-image-fallback ${className}`}>
      <span>🍽️</span>
    </div>
  ) : (
    <img
      src={meal.image}
      alt={meal.name}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function MealPlan() {
  const navigate = useNavigate();

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [planDays, setPlanDays] = useState([]);
  const [basket, setBasket] = useState(null);
  const [remotePreferences, setRemotePreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("mealmate_favorite_meals") || "[]"
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const localPreferences = useMemo(readPreferences, []);
  const preferences = remotePreferences || localPreferences;

  const loadPlan = async () => {
    setLoading(true);
    setError("");
    try {
      const [planResult, basketResult, preferencesResult] = await Promise.allSettled([
        getMyMealPlan(),
        getMyGroceryBasket(),
        getMyFoodPreferences(),
      ]);
      if (planResult.status === "rejected") {
  const err = planResult.reason;

  console.error("Meal Plan API Error:", {
    status: err.response?.status,
    detail: err.response?.data?.detail,
  });

  throw err;
}
      const days = planResult.value.data?.meal_plan?.days;
      if (!Array.isArray(days)) throw new Error("Invalid meal plan data from server.");
      setPlanDays(days);
      setSelectedDay(0);
      setSelectedMeal(null);
      setBasket(basketResult.status === "fulfilled" ? basketResult.value.data?.grocery_basket : null);
      if (preferencesResult.status === "fulfilled") {
        const p = preferencesResult.value.data;
        setRemotePreferences({
          familyMembers: Number(p.family_members) || 1,
          weeklyBudget: Number(p.weekly_budget) || 0,
          dietType: p.diet_type || "Not specified",
        });
      }
    } catch (err) {
      setError(err.response?.status === 404
        ? "No saved meal plan found. Click Regenerate Plan to create your first plan."
        : err.response?.status === 401
          ? "Your login has expired. Please log in again."
          : err.response?.data?.detail || err.message || "Could not load meal plan.");
      setPlanDays([]);
      setBasket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlan(); }, []);

  // Preserve the rolling seven-day order returned by FastAPI.
  // For example: Wednesday, Thursday, ..., Tuesday.
  const displayDays = useMemo(() => {
    if (planDays.length > 0) {
      return planDays.map((entry) => String(entry.day || ""));
    }
    return FALLBACK_DAYS;
  }, [planDays]);

  const weeklyPlan = useMemo(() => planDays.map((entry) => {
    const day = String(entry.day || "");
    const meals = Array.isArray(entry.meals) ? entry.meals : [];
    return MEAL_TYPES.map((type) => {
      const meal = meals.find((item) => String(item.meal_type).toLowerCase() === type.toLowerCase());
      return meal ? normalizeMeal(meal, day, meals.indexOf(meal)) : null;
    }).filter(Boolean);
  }), [planDays]);

  const mealsToday = weeklyPlan[selectedDay] || [];
  const dayTotal = mealsToday.reduce((sum, meal) => sum + priceOf(meal), 0);
  const dayCalories = mealsToday.reduce((sum, meal) => sum + meal.nutrition.calories, 0);
  const weeklyTotal = basket ? Number(basket.estimated_total_lkr) : weeklyPlan.flat().reduce((sum, meal) => sum + priceOf(meal), 0);
  const budgetLimit = Number(basket?.weekly_budget_lkr ?? preferences.weeklyBudget);
  const budgetDifference = budgetLimit - weeklyTotal;
  const budgetPercent = budgetLimit > 0 ? Math.round(weeklyTotal / budgetLimit * 100) : 0;
  const isOverBudget = budgetDifference < 0;

  const toggleFavorite = (mealId) => {
    setFavorites((current) => {
      const next = current.includes(mealId)
        ? current.filter((id) => id !== mealId)
        : [...current, mealId];

      try {
        localStorage.setItem(
          "mealmate_favorite_meals",
          JSON.stringify(next)
        );
      } catch {
        // Favorites still work for this session.
      }

      return next;
    });
  };

  const regeneratePlan = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    setSelectedMeal(null);
    try {
      await generateWeeklyMealPlan();
      await loadPlan();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate a meal plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mp-page">
      {/* EXISTING HERO SECTION */}

      <section className="mp-hero-new">
        <div className="mp-hero-content">
          <span className="mp-hero-label">
            <Sparkles size={15} />
            YOUR PERSONALIZED WEEK
          </span>

          <h1>
            My Weekly <span>Meal Plan</span>
            <Leaf className="mp-title-leaf" size={29} />
          </h1>

          <p>
            Explore breakfast, lunch and dinner.
            Select a meal to see ingredients,
            estimated prices and nutrition details.
          </p>

          <div className="mp-hero-tags">
            <div className="mp-hero-tag">
              <Users size={17} />
              <span>
                {preferences.familyMembers} family members
              </span>
            </div>

            <div className="mp-hero-tag">
              <Leaf size={17} />
              <span>{preferences.dietType}</span>
            </div>

            <div className="mp-hero-tag">
              <Wallet size={17} />
              <span>
                Weekly budget:{" "}
                {money(preferences.weeklyBudget)}
              </span>
            </div>
          </div>
        </div>

        <div className="mp-hero-art" aria-hidden="true">
          <div className="mp-hero-green-area" />

          <img
            src="/images/mealmate-ai-robot.png"
            alt=""
            className="mp-robot-image"
          />

          <div className="mp-speech">
            Your personalized
            <br />
            meal plan is ready! 💚
          </div>

          <img
            src="/images/meal-plan-bowl.png"
            alt=""
            className="mp-hero-bowl"
          />

          <Leaf
            className="mp-decor-leaf mp-leaf-one"
            size={37}
          />

          <Leaf
            className="mp-decor-leaf mp-leaf-two"
            size={24}
          />

          <span className="mp-decor-spark mp-spark-one">
            ✦
          </span>

          <span className="mp-decor-spark mp-spark-two">
            ✧
          </span>
        </div>
      </section>

      {/* NEW REFERENCE-STYLE MEAL PLANNER */}

      <section className="mp-ref-planner">
        <div className="mp-ref-topbar">
          <div
            className="mp-ref-days"
            role="tablist"
            aria-label="Select a day"
          >
            {displayDays.map((day, index) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={selectedDay === index}
                className={`mp-ref-day ${
                  selectedDay === index ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedDay(index);
                  setSelectedMeal(null);
                }}
              >
                <span>{day.slice(0, 3)}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="mp-ref-regenerate"
            onClick={regeneratePlan}
            disabled={generating}
          >
            <RefreshCw size={16} />
            {generating ? "Generating..." : "Regenerate Plan"}
          </button>
        </div>

        <div className="mp-ref-heading">
          <div>
            <span className="mp-ref-eyebrow">
              <Sparkles size={14} />
              YOUR DAILY MENU
            </span>

            <h2>
  {displayDays[selectedDay] || "Day"}'s{" "}
  <span style={{ color: "#659c18" }}>
    Meal Plan
  </span>
</h2>
            <p>
              A simple meal plan based on your food
              preferences.
            </p>
          </div>

          <span className="mp-ref-day-label">
            Day {selectedDay + 1} of {displayDays.length}
          </span>
        </div>

        {loading && <p role="status">Loading your saved meal plan...</p>}
        {generating && <p role="status">AI is generating your weekly plan. This may take a few minutes.</p>}
        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
        {!loading && !error && mealsToday.length === 0 && <p>No meals found for this day.</p>}

        <div className="mp-ref-meal-grid">
          {mealsToday.map((meal) => (
            <article
              className="mp-ref-card"
              key={`${selectedDay}-${meal.id}`}
            >
              <button
                type="button"
                className="mp-ref-card-main"
                onClick={() => setSelectedMeal(meal)}
                aria-label={`View ${meal.name} ingredients and nutrition`}
              >
                <div className="mp-ref-image-wrap">
                  <MealImage meal={meal} />

                  
                </div>

                <div className="mp-ref-card-content">
                  <span className="mp-ref-card-category">
                    {meal.type}
                  </span>

                  <h3>{meal.name}</h3>

                  <div className="mp-ref-card-info">
                    <span>
                      <Flame size={15} />
                      {meal.nutrition.calories} kcal
                    </span>

                    <strong>
                      {money(priceOf(meal))}
                    </strong>
                  </div>

                  <span className="mp-ref-card-link">
                    View meal details
                    <ChevronRight size={16} />
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={`mp-ref-favorite ${
                  favorites.includes(meal.id)
                    ? "is-favorite"
                    : ""
                }`}
                aria-label={
                  favorites.includes(meal.id)
                    ? `Remove ${meal.name} from favorites`
                    : `Add ${meal.name} to favorites`
                }
                aria-pressed={favorites.includes(meal.id)}
                onClick={() => toggleFavorite(meal.id)}
              >
                <Heart
                  size={19}
                  fill={
                    favorites.includes(meal.id)
                      ? "currentColor"
                      : "none"
                  }
                />
              </button>
            </article>
          ))}
        </div>

        {/* DAILY SUMMARY + WEEKLY BUDGET */}

        <div className="mp-ref-bottom-grid">
          <article className="mp-ref-summary-card">
            <div className="mp-ref-bottom-title">
              <span className="mp-ref-bottom-icon">
                <CheckCircle2 size={19} />
              </span>

              <h3>Daily Summary</h3>
            </div>

            <div className="mp-ref-summary-stats">
              <div>
                <small>Total Calories</small>
                <strong>
                  {dayCalories.toLocaleString()}{" "}
                  <span>kcal</span>
                </strong>
              </div>

              <div>
                <small>Estimated Daily Cost</small>
                <strong>{money(dayTotal)}</strong>
              </div>
            </div>

            <p className="mp-ref-small-note">
              Costs and nutrition are AI estimates.
              Estimated daily ingredient cost:{" "}
              <strong>
                {money(
                  dayTotal
                )}
              </strong>
              .
            </p>
          </article>

          <article className="mp-ref-budget-card">
            <div className="mp-ref-bottom-title">
              <span className="mp-ref-bottom-icon">
                <Wallet size={19} />
              </span>

              <h3>Weekly Budget</h3>
            </div>

            <div className="mp-ref-budget-values">
              <div>
                <small>Estimated Weekly Grocery Cost</small>
                <strong>{money(weeklyTotal)}</strong>
              </div>

              <div className="mp-ref-budget-limit">
                <small>Weekly Budget</small>
                <strong>
                  {money(budgetLimit)}
                </strong>
              </div>
            </div>

            <div
              className="mp-ref-budget-track"
              role="progressbar"
              aria-label="Weekly budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(
                100,
                budgetPercent
              )}
            >
              <span
                className={`mp-ref-budget-fill ${
                  isOverBudget ? "over-budget" : ""
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    budgetPercent
                  )}%`,
                }}
              />
            </div>

            <div className="mp-ref-budget-caption">
              <span>{budgetPercent}% used</span>

              <span
                className={
                  isOverBudget ? "mp-ref-over-text" : ""
                }
              >
                {isOverBudget
                  ? `${money(-budgetDifference)} over budget`
                  : `${money(budgetDifference)} remaining`}
              </span>
            </div>

            <p className="mp-ref-small-note">
              Illustrative prices, not live local market
              prices.
            </p>
          </article>
        </div>

        <div className="mp-ref-actions">
          <button
            type="button"
            className="mp-ref-basket-button"
            onClick={() =>
              navigate("/weekly-grocery-basket")
            }
          >
            <ShoppingBasket size={19} />
            View Weekly Grocery Basket
            <ChevronRight size={17} />
          </button>
        </div>
      </section>

      {/* EXISTING MEAL DETAILS MODAL */}

      {selectedMeal && (
        <div
          className="mp-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedMeal(null);
            }
          }}
        >
          <section
            className="mp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedMeal.name} details`}
          >
            <button
              type="button"
              className="mp-close"
              aria-label="Close meal details"
              onClick={() => setSelectedMeal(null)}
            >
              <X size={21} />
            </button>

            <div className="mp-modal-top">
              <MealImage meal={selectedMeal} />

              <div>
                <span className="mp-kicker">
                  {selectedMeal.type} ·{" "}
                  {displayDays[selectedDay]}
                </span>

                <h2>{selectedMeal.name}</h2>

                <p>
                  Estimated meal ingredient cost:{" "}
                  <strong>
                    {money(priceOf(selectedMeal))}

                  </strong>
                </p>

              </div>
            </div>

            <div className="mp-modal-columns">
              <div>
                <h3>
                  Ingredients & estimated prices
                </h3>

                <div className="mp-ingredients">
                  {selectedMeal.ingredients.map(
                    ([name, quantity, price]) => (
                      <div key={name}>
                        <span>
                          {name}
                          <small>
                            {quantity} (planned quantity)
                          </small>
                        </span>

                        <strong>
                          {money(price)}
                        </strong>
                      </div>
                    )
                  )}
                </div>

                <div className="mp-ingredient-total">
                  <span>Estimated meal ingredient total</span>
                  <strong>
                    {money(priceOf(selectedMeal))}
                  </strong>
                </div>
              </div>

              <div>
                <h3>Estimated meal nutrition</h3>

                <p className="mp-nutrition-caption">
                  Illustrative daily goals only. AI nutrition values may not be per-person estimates.
                </p>

                {METRICS.map(
                  ([key, label, unit]) => {
                    const value =
                      selectedMeal.nutrition[key];

                    const pct = Math.round(
                      (value / GOALS[key]) * 100
                    );

                    return (
                      <div
                        className="mp-nutrition"
                        key={key}
                      >
                        <div>
                          <span>{label}</span>

                          <strong>
                            {value} {unit} · {pct}%
                          </strong>
                        </div>

                        <div className="mp-progress">
                          <span
                            style={{
                              width: `${Math.min(
                                100,
                                pct
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}