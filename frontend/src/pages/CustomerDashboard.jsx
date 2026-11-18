
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CalendarDays,
  ShoppingBasket,
  HeartPulse,
  Settings,
  Users,
  Wallet,
  Leaf,
  ArrowRight,
  ArrowUpRight,
  Sun,
  Moon,
  Flame,
  Dumbbell,
  Wheat,
  Droplets,
  Info,
  Sparkles,
  Utensils,
  Clock3,
  CheckCircle2,
  UserRound,
  Coins,
} from "lucide-react";

import "../styles/CustomerDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ROUTES = {
  dashboard: "/customer/dashboard",
  preferences: "/food-preferences",
  mealPlan: "/meal-plan",
  basket: "/weekly-grocery-basket",
  shops: "/choose-partner-shop",
  orders: "/my-orders",
  subscription: "/premium-plans",
  notifications: "/notifications",
  profile: "/my-profile",
  login: "/login",
};

/* Real data comes from the authenticated customer's backend records. */
const MEAL_DISPLAY = {
  breakfast: { name: "Breakfast", time: "Morning", image: "/images/meal-breakfast.jpg", icon: Sun, theme: "plum" },
  lunch: { name: "Lunch", time: "Afternoon", image: "/images/meal-lunch.jpg", icon: Sun, theme: "yellow" },
  dinner: { name: "Dinner", time: "Evening", image: "/images/meal-dinner.jpg", icon: Moon, theme: "green" },
};

const NUTRIENTS = [
  { label: "Calories", key: "calories", unit: "kcal", icon: Flame, theme: "plum" },
  { label: "Protein", key: "protein", unit: "g", icon: Dumbbell, theme: "green" },
  { label: "Carbs", key: "carbs", unit: "g", icon: Wheat, theme: "yellow" },
  { label: "Fats", key: "fat", unit: "g", icon: Droplets, theme: "purple" },
  { label: "Fiber", key: "fiber", unit: "g", icon: Leaf, theme: "green" },
];

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const formatNumber = (value) => asNumber(value).toLocaleString("en-LK", { maximumFractionDigits: 1 });
const formatLkr = (value) => `Rs. ${asNumber(value).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const todayInSriLanka = () => new Intl.DateTimeFormat("en-US", {
  weekday: "long", timeZone: "Asia/Colombo",
}).format(new Date());

/* ==========================================
   CUSTOMER DASHBOARD

   Navbar is handled by CustomerLayout.jsx
========================================== */

export default function CustomerDashboard() {
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);
  const [mealPlan, setMealPlan] = useState(null);
  const [basket, setBasket] = useState(null);
  const [dataError, setDataError] = useState("");

  /* ==========================================
     LOAD CUSTOMER
  ========================================== */

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomer() {
      const token = localStorage.getItem("mealmate_token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      if (!token) {
        navigate(ROUTES.login, { replace: true });
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.status === 401) {
          ["mealmate_token", "access_token", "token"].forEach((key) =>
            localStorage.removeItem(key)
          );
          navigate(ROUTES.login, { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load customer profile (HTTP ${response.status}).`);
        }

        const data = await response.json();
        if (controller.signal.aborted) return;
        setCustomer(data);

        const endpoints = [
          "/food-preferences/me",
          "/meal-plan/me",
          "/meal-plan/me/grocery-basket",
        ];

        const results = await Promise.allSettled(
          endpoints.map(async (endpoint) => {
            const res = await fetch(`${API_URL}${endpoint}`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            });

            // A new customer may not have preferences, a meal plan, or a basket.
            if (res.status === 404) return null;

            if (!res.ok) {
              const body = await res.json().catch(() => null);
              console.warn("Dashboard API response:", endpoint, res.status, body);
              // A 422 is not necessarily 'no data': show a safe text warning,
              // rather than attempting to render FastAPI's detail objects.
              throw new Error(`${endpoint}: HTTP ${res.status}`);
            }
            return res.json();
          })
        );

        if (controller.signal.aborted) return;
        if (results[0].status === "fulfilled") setPreferences(results[0].value);
        if (results[1].status === "fulfilled") setMealPlan(results[1].value);
        if (results[2].status === "fulfilled") setBasket(results[2].value);

        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          failures.forEach((result) => console.error("Dashboard data error:", result.reason));
          setDataError("Some dashboard details could not be loaded. Please refresh to try again.");
        } else {
          setDataError("");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Customer loading error:", error);
          if (!controller.signal.aborted) {
            setDataError(error.message || "Unable to load your dashboard.");
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCustomer();
    return () => controller.abort();
  }, [navigate]);

  /* ==========================================
     NAVIGATION
  ========================================== */

  function goTo(path) {
    if (!path) return;
    navigate(path);
  }

  const firstName =
    customer?.full_name?.split(" ")[0] || "Customer";

  const days = Array.isArray(mealPlan?.meal_plan?.days) ? mealPlan.meal_plan.days : [];
  const todayDay = days.find((day) => day?.day === todayInSriLanka());
  const todayMeals = Array.isArray(todayDay?.meals) ? todayDay.meals : [];
  const displayMeals = ["breakfast", "lunch", "dinner"].flatMap((type) => {
    const meal = todayMeals.find((item) => item?.meal_type === type);
    return meal ? [{ ...MEAL_DISPLAY[type], food: meal.name, calories: meal.nutrition?.calories,
      price: meal.estimated_price_lkr, hasNutrition: meal.nutrition != null }] : [];
  });
  const nutritionTotals = NUTRIENTS.map((item) => ({
    ...item,
    current: todayMeals.reduce((sum, meal) => sum + asNumber(meal?.nutrition?.[item.key]), 0),
  }));
  const hasPreferences = preferences !== null;
  const hasMealPlan = days.length > 0;
  const startPath = hasPreferences ? ROUTES.mealPlan : ROUTES.preferences;

  /* ==========================================
     DASHBOARD CONTENT ONLY
     NO SIDEBAR
     NO TOP NAVBAR
  ========================================== */

  return (
    <>
      {dataError && <p role="alert" className="mm-dashboard-data-error">{dataError}</p>}
      {/* =====================================
          WELCOME HERO
      ===================================== */}

      <section className="mm-welcome">
        <div className="mm-welcome-text">
          <span className="mm-eyebrow">
            🌿 YOUR HEALTHY JOURNEY
          </span>

          <h1>
            Welcome back,{" "}
            {loading ? "..." : firstName}! 👋
          </h1>

          <p>
            A healthier lifestyle begins with small
            steps. Plan your meals, manage your grocery
            budget, and enjoy balanced nutrition
            every day.
          </p>

          <button
            type="button"
            className="mm-primary-button"
            onClick={() => goTo(loading ? ROUTES.mealPlan : startPath)}
          >
            {loading ? "Explore Meal Plan" : !hasPreferences ? "Set Food Preferences" : hasMealPlan ? "Explore Meal Plan" : "Generate Meal Plan"}
            <ArrowRight size={18} />
          </button>
        </div>

        {/* FLOATING FEATURE CARDS */}

        <div className="mm-hero-features">
          <div className="mm-hero-feature feature-one">
            <span className="mm-feature-icon">
              📅
            </span>
            <strong>Plan Meals</strong>
            <span className="mm-feature-check">
              ✓
            </span>
          </div>

          <div className="mm-hero-feature feature-two">
            <span className="mm-feature-icon">
              🧺
            </span>
            <strong>Build Basket</strong>
            <span className="mm-feature-check">
              ✓
            </span>
          </div>

          <div className="mm-hero-feature feature-three">
            <span className="mm-feature-icon">
              💗
            </span>
            <strong>Track Nutrition</strong>
            <span className="mm-feature-check">
              ✓
            </span>
          </div>
        </div>

        <div
          className="mm-welcome-art"
          aria-hidden="true"
        >
          <div className="mm-art-circle">
            🥗
          </div>

          <span className="mm-art-leaf">
            🌿
          </span>
        </div>
      </section>

      {/* =====================================
          WEEKLY OVERVIEW
      ===================================== */}

      <div className="mm-section-title mm-overview-heading">
        <div>
          <h2>
            <CalendarDays size={25} />
            Your <span>Weekly</span> Overview
          </h2>

          <p>
            Keep track of your healthy eating journey
          </p>
        </div>
      </div>

      <section className="mm-stats mm-overview-cards">

        {/* FAMILY MEMBERS */}

        <button
          type="button"
          className="mm-stat-card mm-overview-card mm-overview-family"
          onClick={() => goTo(ROUTES.preferences)}
        >
          <div className="mm-overview-icon">
            <Users size={34} strokeWidth={2.3} />
          </div>

          <h3>Family Members</h3>

          <span className="mm-overview-status">
            {loading ? "Loading..." : preferences?.family_members != null ? `${preferences.family_members} members` : "Not set"}
          </span>

          <p>Update your food preferences</p>

          <span className="mm-overview-arrow">
            <ArrowUpRight size={22} />
          </span>
        </button>

        {/* WEEKLY BUDGET */}

        <button
          type="button"
          className="mm-stat-card mm-overview-card mm-overview-budget"
          onClick={() => goTo(ROUTES.preferences)}
        >
          <div className="mm-overview-icon">
            <Wallet size={34} strokeWidth={2.3} />
          </div>

          <h3>Weekly Budget</h3>

          <span className="mm-overview-status">
            {loading ? "Loading..." : preferences?.weekly_budget != null ? formatLkr(preferences.weekly_budget) : "Not set"}
          </span>

          <p>Set your weekly spending limit</p>

          <span className="mm-overview-arrow">
            <ArrowUpRight size={22} />
          </span>
        </button>

        {/* WEEKLY MEAL PLAN */}

        <button
          type="button"
          className="mm-stat-card mm-overview-card mm-overview-meals"
          onClick={() => goTo(ROUTES.mealPlan)}
        >
          <div className="mm-overview-icon">
            <CalendarDays
              size={34}
              strokeWidth={2.3}
            />
          </div>

          <h3>Weekly Meal Plan</h3>

          <span className="mm-overview-status">
            {loading ? "Loading..." : hasMealPlan ? "Generated" : "Not generated"}
          </span>

          <p>Create your personalized plan</p>

          <span className="mm-overview-arrow">
            <ArrowUpRight size={22} />
          </span>
        </button>

        {/* NUTRITION TRACKING */}

        <button
          type="button"
          className="mm-stat-card mm-overview-card mm-overview-nutrition"
          onClick={() => goTo(ROUTES.mealPlan)}
        >
          <div className="mm-overview-icon">
            <HeartPulse
              size={34}
              strokeWidth={2.3}
            />
          </div>

          <h3>Nutrition Tracking</h3>

          <span className="mm-overview-status">
            {loading ? "Loading..." : hasMealPlan ? "Plan available" : "Not started"}
          </span>

          <p>Track your daily nutrition</p>

          <span className="mm-overview-arrow">
            <ArrowUpRight size={22} />
          </span>
        </button>
      </section>

      {/* =====================================
          TODAY'S MEALS + NUTRITION
      ===================================== */}

      <div className="mm-dashboard-grid">

        {/* TODAY'S MEAL PREVIEW */}

        <section className="mm-panel mm-meal-preview-panel">
          <div className="mm-redesign-header">
            <div className="mm-redesign-title-group">
              <span className="mm-redesign-header-icon">
                <Utensils size={26} />
              </span>

              <div>
                <h2>Today's Meal Preview</h2>
                <p>
                  {hasMealPlan ? "Meals from your saved plan" : "Your personalized meals will appear here"}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mm-redesign-view-all"
              onClick={() => goTo(ROUTES.mealPlan)}
            >
              View All
              <ArrowRight size={17} />
            </button>
          </div>

          <div className="mm-redesign-meal-list">
            {loading && <p>Loading your meal plan...</p>}
            {!loading && !dataError && !hasMealPlan && (
              <div className="mm-dashboard-empty">
                <p>You haven't generated a weekly meal plan yet.</p>
                <button type="button" className="mm-primary-button" onClick={() => goTo(startPath)}>
                  {hasPreferences ? "Generate Meal Plan" : "Set Food Preferences"} <ArrowRight size={17} />
                </button>
              </div>
            )}
            {!loading && hasMealPlan && !todayDay && (
              <div className="mm-dashboard-empty">
                <p>No meal schedule is available for {todayInSriLanka()} in your saved plan.</p>
                <button type="button" className="mm-primary-button" onClick={() => goTo(ROUTES.mealPlan)}>View Meal Plan <ArrowRight size={17} /></button>
              </div>
            )}
            {!loading && displayMeals.map((meal) => {
              const MealIcon = meal.icon;

              return (
                <div
                  key={meal.name}
                  className={`mm-redesign-meal-card mm-theme-${meal.theme}`}
                >
                  <div className="mm-redesign-meal-image">
                    <img
                      src={meal.image}
                      alt={meal.food}
                      loading="lazy"
                    />
                  </div>

                  <div className="mm-redesign-meal-details">
                    <span className="mm-redesign-meal-time">
                      <MealIcon size={15} />
                      {meal.name} · {meal.time}
                    </span>

                    <h3>{meal.food}</h3>

                    <div className="mm-redesign-meal-meta">
                      <span className="mm-redesign-calorie">
                        <Flame size={15} />
                        {formatNumber(meal.calories)} kcal
                      </span>

                      <span className="mm-redesign-sample">
                        {formatLkr(meal.price)} estimated
                      </span>
                    </div>
                  </div>

                  <span
                    className="mm-redesign-meal-end-icon"
                    aria-hidden="true"
                  >
                    <MealIcon size={25} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* NUTRITION OVERVIEW */}

        <section className="mm-panel mm-nutrition-preview-panel">
          <div className="mm-redesign-header">
            <div className="mm-redesign-title-group">
              <span className="mm-redesign-header-icon">
                <HeartPulse size={26} />
              </span>

              <div>
                <h2>Nutrition Overview</h2>
                <p>
                  {hasMealPlan ? "Planned family nutrition for today" : "Your planned nutrition will appear here"}
                </p>
              </div>
            </div>
          </div>

          <div className="mm-redesign-nutrition-list">
            {loading && <p>Loading nutrition details...</p>}
            {!loading && !dataError && !todayDay && (
              <div className="mm-dashboard-empty">
                <p>{hasMealPlan ? "No planned nutrition available for today." : "Nutrition details will appear after you generate a meal plan."}</p>
              </div>
            )}
            {!loading && todayDay && nutritionTotals.map((item) => {
              const NutritionIcon = item.icon;

              return (
                <div
                  key={item.label}
                  className={`mm-redesign-nutrition-item mm-theme-${item.theme}`}
                >
                  <span className="mm-redesign-nutrition-icon">
                    <NutritionIcon size={24} />
                  </span>

                  <div className="mm-redesign-nutrition-main">
                    <div className="mm-redesign-nutrition-top">
                      <strong>{item.label}</strong>

                      <span>
                        {formatNumber(item.current)} {item.unit} planned
                      </span>
                    </div>

                  </div>

                  <span className="mm-redesign-percent">
                    {formatNumber(item.current)} {item.unit}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mm-redesign-nutrition-note">
            <Info size={20} />

            <span>
              {todayDay
                ? "Estimated nutrition for the whole family from today's planned meals; not food consumed. Daily goals are not configured."
                : "Nutrition values will appear when today's meal plan is available."}
            </span>
          </div>
        </section>
      </div>

      {/* =====================================
          WEEKLY BASKET + QUICK ACTIONS
      ===================================== */}

      <div className="mm-bottom-redesign">

        {/* WEEKLY GROCERY BASKET */}

        <section className="mm-basket-redesign">
          <div className="mm-bottom-heading">
            <div className="mm-bottom-heading-left">
              <span className="mm-bottom-heading-icon">
                <ShoppingBasket size={27} />
              </span>

              <div>
                <h2>Weekly Grocery Basket</h2>
                <p>
                  Your planned grocery ingredients
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mm-basket-view-btn"
              onClick={() => goTo(ROUTES.basket)}
            >
              View Basket
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="mm-basket-feature">
            <div className="mm-basket-image-wrap">
              <span className="mm-basket-image-glow" />

              <img
                src="/images/mealmate-basket-illustration.png"
                alt="Illustration of a grocery basket"
                className="mm-basket-main-image"
              />

              <span className="mm-basket-sparkle sparkle-one">
                ✦
              </span>

              <span className="mm-basket-sparkle sparkle-two">
                ✦
              </span>
            </div>

            <div className="mm-basket-feature-content">
              <span className="mm-basket-small-label">
                <Leaf size={15} />
                PLAN SMART. EAT HEALTHY.
              </span>

              <h3>{basket ? "Your grocery basket is ready!" : "Your basket is waiting!"}</h3>

              <p>
                {basket
                  ? `Your estimated grocery basket total is ${formatLkr(basket.estimated_total_lkr)}. View your ingredients and quantities.`
                  : "Generate your weekly meal plan to prepare a personalized grocery ingredient list for the week."}
              </p>

              <button
                type="button"
                className="mm-basket-main-btn"
                onClick={() => goTo(ROUTES.basket)}
              >
                <ShoppingBasket size={21} />
                Go to Grocery Basket
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <div className="mm-basket-benefits">
            <div className="mm-basket-benefit">
              <Leaf size={24} />
              <span>
                From your
                <br />
                meal plan
              </span>
            </div>

            <div className="mm-basket-benefit">
              <Clock3 size={24} />
              <span>
                Saves
                <br />
                time
              </span>
            </div>

            <div className="mm-basket-benefit">
              <Coins size={24} />
              <span>
                Helps you
                <br />
                shop smart
              </span>
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS */}

        <section className="mm-quick-redesign">
          <div className="mm-bottom-heading">
            <div className="mm-bottom-heading-left">
              <span className="mm-bottom-heading-icon">
                <Sparkles size={27} />
              </span>

              <div>
                <h2>Quick Actions</h2>
                <p>
                  Everything you need in one place
                </p>
              </div>
            </div>
          </div>

          <div className="mm-quick-redesign-grid">

            {/* FOOD PREFERENCES */}

            <button
              type="button"
              className="mm-quick-tile mm-quick-green"
              onClick={() => goTo(ROUTES.preferences)}
            >
              <span className="mm-quick-tile-icon">
                <Settings size={28} />
              </span>

              <h3>Food Preferences</h3>

              <p>
                Set your food choices and dietary needs
              </p>

              <span className="mm-quick-tile-arrow">
                <ArrowUpRight size={22} />
              </span>
            </button>

            {/* MEAL PLANNER */}

            <button
              type="button"
              className="mm-quick-tile mm-quick-yellow"
              onClick={() => goTo(ROUTES.mealPlan)}
            >
              <span className="mm-quick-tile-icon">
                <CalendarDays size={28} />
              </span>

              <h3>Meal Planner</h3>

              <p>
                Create and view your meal plan
              </p>

              <span className="mm-quick-tile-arrow">
                <ArrowUpRight size={22} />
              </span>
            </button>

            {/* GROCERY BASKET */}

            <button
              type="button"
              className="mm-quick-tile mm-quick-purple"
              onClick={() => goTo(ROUTES.basket)}
            >
              <span className="mm-quick-tile-icon">
                <ShoppingBasket size={28} />
              </span>

              <h3>Grocery Basket</h3>

              <p>
                See your weekly ingredient list
              </p>

              <span className="mm-quick-tile-arrow">
                <ArrowUpRight size={22} />
              </span>
            </button>

            {/* MY PROFILE */}

            <button
              type="button"
              className="mm-quick-tile mm-quick-green"
              onClick={() => goTo(ROUTES.profile)}
            >
              <span className="mm-quick-tile-icon">
                <UserRound size={28} />
              </span>

              <h3>My Profile</h3>

              <p>
                Manage your account and settings
              </p>

              <span className="mm-quick-tile-arrow">
                <ArrowUpRight size={22} />
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* =====================================
          BOTTOM CTA
      ===================================== */}

      <section className="mm-bottom-banner">
        <div>
          <h2>
            <CheckCircle2 size={22} />
            Ready to plan a healthier week?
          </h2>

          <p>
            Tell MealMate about your family,
            budget and food preferences.
          </p>
        </div>

        <button
          type="button"
          className="mm-primary-button"
          onClick={() => goTo(ROUTES.preferences)}
        >
          Get Started
          <ArrowRight size={17} />
        </button>
      </section>
    </>
  );
}
