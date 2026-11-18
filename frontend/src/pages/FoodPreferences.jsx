



import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Sparkles,
  Users,
  Wallet,
  HeartPulse,
  Utensils,
  Leaf,
  Drumstick,
  Sprout,
  Fish,
  X,
  Plus,
  Minus,
  Salad,
  Check,
  Heart,
  HeartOff,
  NotebookPen,
  ArrowRight,
  Trash2,
  CalendarDays,
} from "lucide-react";

import "../styles/CustomerDashboard.css";
import "../styles/FoodPreferencesEmbedded.css";
import {
  createFoodPreferences,
  getMyFoodPreferences,
  updateMyFoodPreferences,
} from "../services/api";


const STORAGE_KEY = "mealmate_food_preferences";

const routes = {
  dashboard: "/customer/dashboard",
  preferences: "/food-preferences",
  mealPlan: "/meal-plan",
  basket: "/weekly-grocery-basket",
  shops: "/choose-partner-shop",
  orders: "/my-orders",
  premium: "/premium-plans",
  notifications: "/notifications",
  profile: "/my-profile",
};

const initialData = {
  familyMembers: 4,
  weeklyBudget: "5000",
  dietType: "Vegetarian",
  healthNeeds: ["Low Sugar"],
  favoriteFoods: ["Rice", "Dhal", "Banana", "Carrot"],
  dislikedFoods: ["Bitter Gourd", "Brinjal"],
  extraPreferences: "",
  startDay: "Today",
};

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dietOptions = [
  { name: "Vegetarian", icon: Leaf },
  { name: "Non-Vegetarian", icon: Drumstick },
  { name: "Vegan", icon: Sprout },
  { name: "Pescatarian", icon: Fish },
];

const suggestedNeeds = [
  "Low Sugar",
  "Low Salt",
  "High Protein",
  "Low Fat",
  "High Fiber",
];

function FoodPreferences() {
  const navigate = useNavigate();

  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...initialData, ...saved } : initialData;
    } catch {
      return initialData;
    }
  });

  const [inputs, setInputs] = useState({
    healthNeeds: "",
    favoriteFoods: "",
    dislikedFoods: "",
  });

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);

  // The backend is the source of truth; localStorage is only a UI cache.
  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      try {
        const response = await getMyFoodPreferences();
        if (!active) return;
        const saved = response.data;
        setHasSavedPreferences(true);
        setForm((previous) => {
          const next = {
            ...previous,
            familyMembers: saved.family_members,
            weeklyBudget: String(saved.weekly_budget),
            dietType: saved.diet_type,
            healthNeeds: saved.health_conditions || [],
            favoriteFoods: saved.preferred_foods || [],
            dislikedFoods: saved.disliked_foods || [],
            startDay: saved.start_day || previous.startDay || "Today",
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 404) {
          setHasSavedPreferences(false);
        } else {
          setMessage(
            error.response?.status === 401
              ? "Please log in again to load your food preferences."
              : "Could not load saved preferences. Please check your connection."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPreferences();
    return () => { active = false; };
  }, []);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const addItem = (field, value) => {
    const clean = value.trim();

    if (!clean) return;

    setForm((previous) => {
      const current = previous[field] || [];

      if (
        current.some(
          (item) => item.toLowerCase() === clean.toLowerCase()
        )
      ) {
        return previous;
      }

      const next = {
        ...previous,
        [field]: [...current, clean],
      };

      if (field === "favoriteFoods") {
        next.dislikedFoods = previous.dislikedFoods.filter(
          (item) => item.toLowerCase() !== clean.toLowerCase()
        );
      }

      if (field === "dislikedFoods") {
        next.favoriteFoods = previous.favoriteFoods.filter(
          (item) => item.toLowerCase() !== clean.toLowerCase()
        );
      }

      return next;
    });

    setInputs((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const removeItem = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field].filter((item) => item !== value),
    }));
  };

  const toggleNeed = (need) => {
    if (form.healthNeeds.includes(need)) {
      removeItem("healthNeeds", need);
    } else {
      addItem("healthNeeds", need);
    }
  };

  const renderInputList = (field, placeholder) => (
    <>
      <div className="fp-tags">
        {form[field].map((item) => (
          <span className="fp-tag" key={item}>
            {item}

            <button
              type="button"
              onClick={() => removeItem(field, item)}
              aria-label={`Remove ${item}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>

      <div className="fp-add-row">
        <input
          type="text"
          value={inputs[field]}
          placeholder={placeholder}
          onChange={(event) =>
            setInputs((previous) => ({
              ...previous,
              [field]: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem(field, inputs[field]);
            }
          }}
        />

        <button
          type="button"
          className="fp-add-button"
          onClick={() => addItem(field, inputs[field])}
        >
          <Plus size={17} />
          Add
        </button>
      </div>
    </>
  );

  const savePreferences = async (event) => {
    event.preventDefault();

    if (
      !Number.isInteger(Number(form.familyMembers)) ||
      Number(form.familyMembers) < 1
    ) {
      setMessage("Please enter a valid number of family members.");
      return;
    }

    if (
      !Number.isFinite(Number(form.weeklyBudget)) ||
      Number(form.weeklyBudget) <= 0
    ) {
      setMessage("Please enter a valid weekly budget.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const dataToSave = {
        ...form,
        familyMembers: Number(form.familyMembers),
        weeklyBudget: Number(form.weeklyBudget),
      };

      const payload = {
        family_members: dataToSave.familyMembers,
        weekly_budget: dataToSave.weeklyBudget,
        diet_type: dataToSave.dietType,
        health_conditions: dataToSave.healthNeeds,
        preferred_foods: dataToSave.favoriteFoods,
        disliked_foods: dataToSave.dislikedFoods,
        start_day: dataToSave.startDay,
      };

      // Save to MySQL first; navigate only after successful API response.
      try {
        if (hasSavedPreferences) {
          await updateMyFoodPreferences(payload);
        } else {
          await createFoodPreferences(payload);
        }
      } catch (error) {
        // Handle an existing record discovered after the initial GET.
        if (!hasSavedPreferences && error.response?.status === 409) {
          await updateMyFoodPreferences(payload);
        } else {
          throw error;
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      setHasSavedPreferences(true);
      navigate(routes.mealPlan);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail && typeof error.response.data.detail === "string"
        ? error.response.data.detail
        : "Unable to save preferences to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    setForm({
      familyMembers: 1,
      weeklyBudget: "",
      dietType: "Vegetarian",
      healthNeeds: [],
      favoriteFoods: [],
      dislikedFoods: [],
      extraPreferences: "",
      startDay: "Today",
    });

    setInputs({
      healthNeeds: "",
      favoriteFoods: "",
      dislikedFoods: "",
    });

    setMessage("");
  };

  return (
    <div className="fp-embedded">
        <form onSubmit={savePreferences} className="fp-content">
          
<section className="fp-hero fp-premium-hero">
  <div className="fp-premium-pattern" />

  <div className="fp-premium-content">
    <div className="fp-premium-eyebrow">
      <Sparkles size={17} />
      PERSONALIZE YOUR HEALTHY JOURNEY
    </div>

    <h1 className="fp-premium-title">
      Your Food{" "}
      <span>Preferences</span>
      <span className="fp-title-leaf">🌱</span>
    </h1>

    <div className="fp-premium-underline" />

    <p className="fp-premium-description">
      Tell us about your family, budget, dietary needs
      and food choices to create a personalized weekly
      meal plan.
    </p>

    <div className="fp-premium-benefits">
      <div className="fp-premium-benefit">
        <Users size={19} />
        <span>For your family</span>
      </div>

      <div className="fp-premium-benefit">
        <Wallet size={19} />
        <span>Within your budget</span>
      </div>

      <div className="fp-premium-benefit">
        <HeartPulse size={19} />
        <span>For your dietary needs</span>
      </div>
    </div>
  </div>

  <div className="fp-premium-visual">
    <div className="fp-premium-green-shape" />

    <div className="fp-premium-bowl-wrap">
      <img
        src="/images/healthy-food-bowl.png"
        alt="Healthy meal bowl"
        className="fp-premium-bowl"
      />
    </div>

    <div className="fp-premium-float fp-float-top">
      <Utensils size={26} />
    </div>

    <div className="fp-premium-float fp-float-right">
      <HeartPulse size={27} />
    </div>

    <div className="fp-premium-float fp-float-bottom">
      <Users size={27} />
    </div>

    <span className="fp-premium-leaf fp-leaf-a">🍃</span>
    <span className="fp-premium-leaf fp-leaf-b">🌿</span>
  </div>
</section>


          <div className="fp-grid fp-grid-top">
            <section className="fp-card fp-family-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-green">
                  <Users size={24} />
                </span>

                <div>
                  <h2>1. Family Details</h2>
                  <p>Number of family members</p>
                </div>
              </div>

              <div className="fp-counter">
                <button
                  type="button"
                  onClick={() =>
                    updateField(
                      "familyMembers",
                      Math.max(1, Number(form.familyMembers) - 1)
                    )
                  }
                >
                  <Minus size={19} />
                </button>

                <span>{form.familyMembers}</span>

                <button
                  type="button"
                  onClick={() =>
                    updateField(
                      "familyMembers",
                      Math.min(30, Number(form.familyMembers) + 1)
                    )
                  }
                >
                  <Plus size={19} />
                </button>
              </div>

              <img className="fp-card-image fp-family-image" src="/images/fp-family.png" alt="Happy family" />
            </section>

            <section className="fp-card fp-budget-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-yellow">
                  <Wallet size={24} />
                </span>

                <div>
                  <h2>2. Weekly Budget</h2>
                  <p>Your weekly grocery budget</p>
                </div>
              </div>

              <div className="fp-budget-input">
                <span>LKR</span>
                <input
                  type="number"
                  min="1"
                  value={form.weeklyBudget}
                  placeholder="5000"
                  onChange={(event) =>
                    updateField("weeklyBudget", event.target.value)
                  }
                />
              </div>

              <img className="fp-card-image fp-budget-image" src="/images/fp-grocery.png" alt="Weekly grocery budget" />
            </section>
          </div>

          <div className="fp-grid">
            <section className="fp-card fp-diet-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-purple">
                  <Salad size={24} />
                </span>

                <div>
                  <h2>3. Diet Type</h2>
                  <p>Choose your eating preference</p>
                </div>
              </div>

              <div className="fp-diet-options">
                {dietOptions.map(({ name, icon: Icon }) => (
                  <button
                    type="button"
                    key={name}
                    className={`fp-diet-option ${
                      form.dietType === name ? "selected" : ""
                    }`}
                    onClick={() => updateField("dietType", name)}
                  >
                    {form.dietType === name && (
                      <span className="fp-selected-check">
                        <Check size={13} />
                      </span>
                    )}

                    <Icon size={29} />
                    <strong>{name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="fp-card fp-health-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-green">
                  <HeartPulse size={24} />
                </span>

                <div>
                  <h2>4. Health & Nutrition</h2>
                  <p>Add your dietary needs and health requirements.</p>
                </div>
              </div>
              <img className="fp-section-art" src="/images/fp-health.png" alt="Healthy nutrition" />

              <div className="fp-suggestions">
                {suggestedNeeds.map((need) => (
                  <button
                    key={need}
                    type="button"
                    className={`fp-suggestion ${
                      form.healthNeeds.includes(need)
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => toggleNeed(need)}
                  >
                    {need}
                    {form.healthNeeds.includes(need) ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                  </button>
                ))}
              </div>

              {renderInputList(
                "healthNeeds",
                "e.g. Gluten-free, Lactose-free, Less oily food"
              )}
            </section>
          </div>

          <div className="fp-grid">
            <section className="fp-card fp-favorites-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-yellow">
                  <Heart size={24} />
                </span>

                <div>
                  <h2>5. Favorite Foods</h2>
                  <p>Add the foods you love eating.</p>
                </div>
              </div>
              <img className="fp-section-art" src="/images/fp-favorites.png" alt="Favorite foods" />

              {renderInputList(
                "favoriteFoods",
                "e.g. Idli, Mango, Oats"
              )}
            </section>

            <section className="fp-card fp-dislikes-card fp-animate">
              <div className="fp-card-heading">
                <span className="fp-icon fp-icon-purple">
                  <HeartOff size={24} />
                </span>

                <div>
                  <h2>6. Foods You Dislike</h2>
                  <p>Add the foods you prefer to avoid.</p>
                </div>
              </div>
              <img className="fp-section-art" src="/images/fp-dislikes.png" alt="Foods to avoid" />

              {renderInputList(
                "dislikedFoods",
                "e.g. Mushroom, Beetroot"
              )}
            </section>
          </div>

          <section className="fp-card fp-animate fp-start-day-card" aria-labelledby="fp-start-day-title">
            <div className="fp-card-heading">
              <span className="fp-icon fp-icon-green"><CalendarDays size={24} /></span>
              <div>
                <h2 id="fp-start-day-title">7. Meal Plan Start Day</h2>
                <p>Choose the first day of your personalized 7-day meal plan.</p>
              </div>
            </div>
            <label htmlFor="fp-start-day-select" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
              Start day
            </label>
            <select
              id="fp-start-day-select"
              value={form.startDay}
              onChange={(event) => updateField("startDay", event.target.value)}
              style={{ width: "100%", maxWidth: 340, padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5c0", background: "#fff", color: "#24352b", fontSize: 15 }}
            >
              <option value="Today">Today (recommended)</option>
              {WEEK_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
            <p style={{ marginTop: 12, color: "#60705f", fontSize: 14 }}>
              Your plan will run for 7 consecutive days, starting on the selected day.
            </p>
          </section>

          <section className="fp-card fp-extra-card fp-animate">
            <div className="fp-card-heading">
              <span className="fp-icon fp-icon-green">
                <NotebookPen size={24} />
              </span>

              <div>
                <h2>
                  8. Extra Food Preferences
                  <small> (Optional)</small>
                </h2>

                <p>
                  Any other preferences, meal style or special requests.
                </p>
              </div>
            </div>

           <img className="fp-extra-image" src="/images/fp-extra-preferences.png" alt="Healthy meal and personal food preferences checklist"/>
            <textarea
              value={form.extraPreferences}
              onChange={(event) =>
                updateField(
                  "extraPreferences",
                  event.target.value
                )
              }
              placeholder="e.g. Prefer Sri Lankan meals, less spicy food, more homemade meals..."
              rows={2}
            />
          </section>

          {message && (
            <div className="fp-error" role="alert">
              {message}
            </div>
          )}

          <div className="fp-bottom-actions">
            <button
              type="submit"
              className="fp-save-button"
              disabled={saving || loading}
            >
              <Check size={20} />
              {saving
                ? "Saving..."
                : "Save Preferences & Continue to Meal Plan"}
              <ArrowRight size={20} />
            </button>

            <button
              type="button"
              className="fp-clear-button"
              onClick={clearAll}
            >
              <Trash2 size={17} />
              Clear All
            </button>
          </div>
        </form>
    </div>
  );
}

export default FoodPreferences;