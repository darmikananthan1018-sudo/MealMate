
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  Wallet,
  ReceiptText,
  Save,
  AlertCircle,
  ClipboardList,
  HeartPulse,
  ShoppingCart,
  X,
} from "lucide-react";

import {
  getMyGroceryBasket,
  estimateGroceryItemPrice,
} from "../services/api";

import "../styles/CustomerDashboard.css";

// ==========================================
// HELPERS
// ==========================================

const EDIT_KEY = (id) =>
  `mealmate_basket_edits_${id}`;

const API_URL = "http://127.0.0.1:8000";

async function syncBasketToBackend(basketId, items) {
  const token = localStorage.getItem("mealmate_token") || localStorage.getItem("access_token");
  if (!token) throw new Error("Please log in to save your basket.");

  const payload = {
    items: items.map((item) => {
      const quantity = Number(item.quantity);
      const total = Number(itemTotal(item));
      const unitPrice = quantity > 0 ? total / quantity : 0;
      return {
        name: item.name,
        quantity,
        unit: item.unit,
        estimated_unit_price_lkr: Number(unitPrice.toFixed(4)),
        estimated_total_price_lkr: Number(total.toFixed(2)),
        days_used: item.daysUsed || [],
      };
    }),
  };

  const response = await fetch(`${API_URL}/basket-sync/${basketId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : `Basket save failed (${response.status}).`);
  }
  return data;
}


const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const unitAliases = {
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  l: "L",
  litre: "L",
  liter: "L",
  litres: "L",
  ml: "ml",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  bottle: "bottle",
  bottles: "bottle",
  dozen: "dozen",
  bunch: "bunch",
};

const normalizeUnit = (value) =>
  unitAliases[String(value || "kg").toLowerCase()] ||
  String(value || "kg");

const categoryFor = (name) => {
  const n = normalizeName(name);

  if (/rice|flour|bread|oat|wheat|noodle/.test(n))
    return "Grains";

  if (/dhal|dal|lentil|chickpea|pulse/.test(n))
    return "Pulses";

  if (/banana|apple|mango|papaya|orange|fruit/.test(n))
    return "Fruits";

  if (/egg|fish|chicken|meat|tofu/.test(n))
    return "Protein";

  if (
    /carrot|onion|tomato|potato|cabbage|spinach|vegetable/.test(
      n
    )
  )
    return "Vegetables";

  return "Other";
};

const isWholeUnit = (unit) =>
  ["pcs", "bottle", "dozen", "bunch"].includes(unit);

const quantityStep = (unit) =>
  isWholeUnit(unit) ? 1 : 0.25;

// Convert compatible units into a common unit.
// g -> kg, ml -> L.
// pcs and kg cannot be converted without
// knowing the weight of an individual item.

const standardizeItem = (item) => {
  const originalUnit = normalizeUnit(item.unit);
  const originalQuantity = Number(item.quantity);

  let quantity = originalQuantity;
  let unit = originalUnit;

  if (originalUnit === "g") {
    quantity = originalQuantity / 1000;
    unit = "kg";
  }

  if (originalUnit === "ml") {
    quantity = originalQuantity / 1000;
    unit = "L";
  }

  if (originalUnit === "dozen") {
    quantity = originalQuantity * 12;
    unit = "pcs";
  }

  const total = Number(item.backendTotal);
  const originalPrice = Number(item.unitPrice);

  const hasTotal =
    item.backendTotal !== null &&
    item.backendTotal !== undefined &&
    Number.isFinite(total) &&
    total > 0;

  const hasPrice =
    item.unitPrice !== null &&
    item.unitPrice !== undefined &&
    Number.isFinite(originalPrice) &&
    originalPrice > 0;

  let unitPrice = hasPrice ? originalPrice : null;

  if (hasTotal && quantity > 0) {
    unitPrice = total / quantity;
  } else if (hasPrice && originalQuantity > 0) {
    unitPrice =
      (originalPrice * originalQuantity) / quantity;
  }

  return {
    ...item,
    quantity,
    unit,
    unitPrice,
    backendTotal: hasTotal ? total : null,
  };
};

const itemTotal = (item) => {
  if (
    item.backendTotal !== null &&
    item.backendTotal !== undefined
  ) {
    return Number(item.backendTotal);
  }

  return Number(item.unitPrice || 0) * Number(item.quantity);
};

// Merge repeated names with compatible units.
// Different units without a safe conversion stay separate.

const mergeDuplicates = (rows) => {
  const merged = new Map();

  rows.forEach((raw) => {
    const item = standardizeItem(raw);

    if (!item.name || item.quantity <= 0) return;

    const key = `${normalizeName(item.name)}::${item.unit}`;

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        id: key,
      });
      return;
    }

    const previous = merged.get(key);

    const newQuantity =
      Number(previous.quantity) + Number(item.quantity);

    const newTotal =
      itemTotal(previous) + itemTotal(item);

    merged.set(key, {
      ...previous,
      quantity: Number(newQuantity.toFixed(4)),
      unitPrice:
        newQuantity > 0 ? newTotal / newQuantity : null,
      backendTotal: newTotal,
      category:
        previous.category === "Extra" &&
        item.category !== "Extra"
          ? item.category
          : previous.category,
      daysUsed: [
        ...new Set([
          ...(previous.daysUsed || []),
          ...(item.daysUsed || []),
        ]),
      ],
    });
  });

  return [...merged.values()];
};

const normalizeBackendItem = (item, index) => {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.estimated_unit_price_lkr);
  const total = Number(item.estimated_total_price_lkr);

  return {
    id: `ai-${index}`,
    name: String(item.name || "").trim(),
    quantity:
      Number.isFinite(quantity) && quantity > 0
        ? quantity
        : 1,
    unit: normalizeUnit(item.unit),
    unitPrice:
      Number.isFinite(unitPrice) && unitPrice > 0
        ? unitPrice
        : null,
    backendTotal:
      Number.isFinite(total) && total > 0
        ? total
        : null,
    category: categoryFor(item.name),
    daysUsed: Array.isArray(item.days_used)
      ? item.days_used
      : [],
  };
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function WeeklyGroceryBasket({
  onChoosePartnerShop,
  weeklyBudget: initialBudget,
}) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [basketId, setBasketId] = useState(null);

  const [weeklyBudget, setWeeklyBudget] = useState(
    Number(initialBudget) || 0
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Items");
  const [expandedId, setExpandedId] = useState(null);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("kg");

  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showAddModal) return;
    const handleEscape = (event) => {
      if (event.key === "Escape" && !adding) setShowAddModal(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showAddModal, adding]);

  // ========================================
  // LOAD REAL AI GROCERY BASKET
  // ========================================

  useEffect(() => {
    let cancelled = false;

    const loadBasket = async () => {
      setLoading(true);
      setLoadError("");

      try {
         const response = await getMyGroceryBasket();
        const payload = response.data;

         // Food Preferences is the source of truth for weekly budget.
         const token = localStorage.getItem("mealmate_token") || localStorage.getItem("access_token");
         let preferenceBudget = null;
         if (token) {
           try {
             const prefResponse = await fetch(`${API_URL}/food-preferences/me`, {
               headers: { Authorization: `Bearer ${token}` },
             });
             if (prefResponse.ok) {
               const prefs = await prefResponse.json();
               const value = Number(prefs.weekly_budget);
               if (Number.isFinite(value) && value > 0) preferenceBudget = value;
             }
           } catch (error) {
             console.warn("Unable to load saved weekly budget", error);
           }
         }

        const basket = payload.grocery_basket;

        if (!basket || !Array.isArray(basket.items)) {
          throw new Error(
            "Invalid grocery basket response."
          );
        }

        const generatedItems = mergeDuplicates(
          basket.items.map(normalizeBackendItem)
        );

        let finalItems = generatedItems;

        // Restore only saved edits for this basket.
        // Old invalid pending-price items are excluded.

        try {
          const stored = JSON.parse(
            localStorage.getItem(EDIT_KEY(payload.id)) ||
              "null"
          );

          if (stored && Array.isArray(stored.items)) {
            const validItems = stored.items.filter(
              (item) =>
                item.name &&
                Number(item.quantity) > 0 &&
                item.unitPrice !== null &&
                Number(item.unitPrice) > 0
            );

            finalItems = mergeDuplicates(validItems);
          }
        } catch {
          finalItems = generatedItems;
        }

        if (!cancelled) {
          setItems(finalItems);
          setBasketId(payload.id);

          setWeeklyBudget(
  preferenceBudget ??
    Number(basket.weekly_budget_lkr) ??
    Number(initialBudget) ??
    0
);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error.response?.data?.detail ||
              error.message ||
              "Unable to load grocery basket."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBasket();

    return () => {
      cancelled = true;
    };
  }, [initialBudget]);

  // Keep the read-only navbar cart preview synchronized with basket edits.
  useEffect(() => {
    if (loading || loadError || basketId === null) return;

    const cartSnapshot = {
      basketId,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        total: Number(itemTotal(item).toFixed(2)),
      })),
    };

    localStorage.setItem("mealmate_cart_preview", JSON.stringify(cartSnapshot));
    window.dispatchEvent(new CustomEvent("mealmate:cart-updated", { detail: cartSnapshot }));
  }, [items, basketId, loading, loadError]);

  // ========================================
  // CALCULATIONS
  // ========================================

  const estimatedTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + itemTotal(item),
        0
      ),
    [items]
  );

  const remaining = weeklyBudget - estimatedTotal;
  const budgetReady = Number.isFinite(weeklyBudget) && weeklyBudget > 0;
  const budgetFull = !budgetReady || remaining <= 0.005;
  const overBudget = budgetReady && estimatedTotal > weeklyBudget + 0.005;
  const budgetMessage = !budgetReady
    ? "Please set your weekly budget in Food Preferences first."
    : "Weekly budget limit reached. Remove an item or reduce its quantity to add more.";

  const percent =
    weeklyBudget > 0
      ? Math.round(
          (estimatedTotal / weeklyBudget) * 100
        )
      : 0;

  const numericQuantity = Number(quantity);

  const validQuantity =
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    (!isWholeUnit(unit) ||
      Number.isInteger(numericQuantity));

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      category === "All Items" ||
      (category === "Extra Items"
        ? item.category === "Extra"
        : item.category === category);

    const matchesSearch = normalizeName(
      item.name
    ).includes(normalizeName(search));

    return matchesCategory && matchesSearch;
  });

  // ========================================
  // QUANTITY CONTROLS
  // ========================================

  const changeQuantity = (id, direction) => {
    const target = items.find((item) => item.id === id);
    if (!target || adding) return;
    const step = quantityStep(target.unit);
    const newQuantity = Math.max(
      step,
      Number((Number(target.quantity) + direction * step).toFixed(4))
    );
    if (newQuantity === Number(target.quantity)) return;

    const newCost = Number(target.unitPrice || 0) * newQuantity;
    const nextTotal = estimatedTotal - itemTotal(target) + newCost;
    if (direction > 0 && (!budgetReady || nextTotal > weeklyBudget + 0.005)) {
      setFeedback(!budgetReady
        ? budgetMessage
        : `Cannot increase ${target.name}. Remaining budget: ${money(Math.max(0, remaining))}.`);
      return;
    }

    setItems((previous) => previous.map((item) =>
      item.id === id
        ? { ...item, quantity: newQuantity, backendTotal: null }
        : item
    ));
    setFeedback("");
    setSavedNotice(false);
  };

  // ========================================
  // REMOVE ITEM
  // ========================================

  const removeItem = (id) => {
    setItems((previous) =>
      previous.filter((item) => item.id !== id)
    );

    if (expandedId === id) {
      setExpandedId(null);
    }

    setSavedNotice(false);
  };

  // ========================================
  // ADD ITEM WITH GROQ AI PRICE
  // ========================================

  const addItem = async (event) => {
    event.preventDefault();

    if (!name.trim() || !validQuantity || adding) {
      setFeedback(
        "Enter a valid item name and quantity."
      );
      return;
    }

    if (budgetFull) {
      setFeedback(budgetMessage);
      return;
    }

    setAdding(true);
    setFeedback("AI is estimating the grocery price...");

    try {
      const response = await estimateGroceryItemPrice({
        name: name.trim(),
        quantity: numericQuantity,
        unit,
      });

      const result = response.data;

      const aiUnitPrice = Number(
        result.estimated_unit_price_lkr
      );

      const aiTotal = Number(
        result.estimated_total_price_lkr
      );

      if (
        !Number.isFinite(aiUnitPrice) ||
        aiUnitPrice <= 0 ||
        !Number.isFinite(aiTotal) ||
        aiTotal <= 0
      ) {
        throw new Error(
          "AI did not return a valid estimated price."
        );
      }

      // Check the price BEFORE adding anything to the basket.
      if (estimatedTotal + aiTotal > weeklyBudget + 0.005) {
        setFeedback(
          `Cannot add ${name.trim()}. Estimated cost: ${money(aiTotal)}. ` +
          `Remaining budget: ${money(Math.max(0, remaining))}. Please choose a cheaper item or reduce the quantity.`
        );
        return;
      }

      const newItem = {
        id: `extra-${Date.now()}`,
        name: name.trim(),
        quantity: numericQuantity,
        unit,
        unitPrice: aiUnitPrice,
        backendTotal: aiTotal,
        category: "Extra",
        daysUsed: [],
      };

      // If the item already exists, merge it.
      // Do not create a repeated grocery card.

      setItems((previous) =>
        mergeDuplicates([...previous, newItem])
      );

      setFeedback(
        `${name.trim()} added. AI estimated total: ${money(
          aiTotal
        )}`
      );

      setName("");
      setQuantity("1");
      setUnit("kg");

      setCategory("All Items");
      setSearch("");
      setSavedNotice(false);
      setShowAddModal(false);
    } catch (error) {
      setFeedback(
        error.response?.data?.detail ||
          error.message ||
          "AI price estimation failed. Please try again."
      );
    } finally {
      setAdding(false);
    }
  };

  // ========================================
  // SAVE BASKET
  // ========================================

  const saveBasket = async () => {
    if (basketId === null || saving) {
      setFeedback("Generate your meal plan first, or wait for saving to finish.");
      return false;
    }

    if (!budgetReady || overBudget) {
      setFeedback(!budgetReady
        ? budgetMessage
        : `Basket exceeds your weekly budget by ${money(estimatedTotal - weeklyBudget)}. Reduce items before saving.`);
      return false;
    }

    setSaving(true);
    setSavedNotice(false);
    setFeedback("");
    try {
      // Persist the exact edited basket in MySQL, not just this browser.
      await syncBasketToBackend(basketId, items);
      localStorage.removeItem(EDIT_KEY(basketId));
      setSavedNotice(true);
      return true;
    } catch (error) {
      // Preserve edits locally if network/server save fails.
      try {
        localStorage.setItem(EDIT_KEY(basketId), JSON.stringify({ items }));
      } catch { /* ignore localStorage failure */ }
      setFeedback(error.message || "Could not save your basket to the server.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // CHOOSE PARTNER SHOP
  // ========================================

  const chooseShop = async () => {
    const saved = await saveBasket();
    if (!saved) return;

    if (typeof onChoosePartnerShop === "function") {
      onChoosePartnerShop();
    } else {
      navigate("/choose-partner-shop");
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <main className="wgb-page">

      {/* LOADING / ERROR */}

      {loading && (
        <p role="status">
          Loading your AI-generated grocery basket...
        </p>
      )}

      {loadError && (
        <p role="alert" className="wgb-warning">
          <AlertCircle size={17} />
          {loadError}
        </p>
      )}

      {/* HERO SECTION */}

      <section className="wgb-new-hero">
        <div className="wgb-new-hero-content">
          <div className="wgb-new-hero-badge">
            <ShoppingBasket size={15} />
            <span>
              YOUR WEEKLY GROCERY BASKET
            </span>
          </div>

          <h1 className="wgb-new-hero-title">
            Your Weekly{" "}
            <span>
              Grocery Basket
              <span className="wgb-title-underline" />
            </span>
            <span className="wgb-title-leaf">
              🌱
            </span>
          </h1>

          <p className="wgb-new-hero-description">
            Get a complete grocery list for your
            weekly meals, matched to your family,
            budget and food preferences.
          </p>

          <div className="wgb-new-hero-features">
            <div className="wgb-new-feature">
              <ShoppingBasket size={18} />
              <span>Planned for your meals</span>
            </div>

            <div className="wgb-new-feature">
              <Wallet size={18} />
              <span>Within your budget</span>
            </div>

            <div className="wgb-new-feature">
              <HeartPulse size={18} />
              <span>Nutritious & balanced</span>
            </div>
          </div>
        </div>

        <div className="wgb-new-hero-visual">
          <div className="wgb-new-hero-circle" />

          <div className="wgb-floating-icon wgb-icon-cart">
            <ShoppingCart size={24} />
          </div>

          <div className="wgb-floating-icon wgb-icon-health">
            <HeartPulse size={24} />
          </div>

          <div className="wgb-floating-icon wgb-icon-list">
            <ClipboardList size={24} />
          </div>

          <img
            src="/images/grocery-basket-hero.png"
            alt="Weekly Grocery Basket"
            className="wgb-new-hero-image"
          />
        </div>
      </section>

      {/* SUMMARY CARDS */}

      <section
        className="wgb-stats wgb-reveal"
        aria-label="Basket overview"
      >
        <article className="wgb-stat">
          <span className="wgb-stat-icon lavender">
            <ShoppingBasket />
          </span>
          <span>Basket Items</span>
          <strong>{items.length}</strong>
        </article>

        <article className="wgb-stat">
          <span className="wgb-stat-icon green">
            <Wallet />
          </span>
          <span>Weekly Budget</span>
          <strong>{money(weeklyBudget)}</strong>
        </article>

        <article className="wgb-stat">
          <span className="wgb-stat-icon peach">
            <ReceiptText />
          </span>
          <span>Estimated Total</span>
          <strong>{money(estimatedTotal)}</strong>
        </article>
      </section>

      {/* GROCERY ITEMS */}

      <section className="wgb-panel wgb-essentials wgb-reveal">
        <div className="wgb-section-heading">
          <div>
            <h2>Your Grocery Essentials</h2>
            <p>
              Adjust quantities, check details,
              or remove what you don't need.
            </p>
          </div>

          <span className="wgb-count">
            {items.length} items
          </span>
        </div>

        {/* SEARCH */}

        <label className="wgb-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search ingredients in your basket..."
          />
        </label>

        {/* FILTER BUTTONS */}

        <div className="wgb-filters">
          {[
            "All Items",
            "Grains",
            "Pulses",
            "Vegetables",
            "Fruits",
            "Protein",
            "Extra Items",
          ].map((filter) => (
            <button
              type="button"
              key={filter}
              className={
                category === filter ? "active" : ""
              }
              onClick={() => setCategory(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* ITEM CARDS */}

        <div className="wgb-item-list">
          {!loading &&
            !loadError &&
            filteredItems.length === 0 && (
              <p className="wgb-empty">
                No matching items found.
              </p>
            )}

          {filteredItems.map((item) => {
            const expanded =
              expandedId === item.id;

            return (
              <article
                key={item.id}
                className={`wgb-item ${
                  expanded ? "expanded" : ""
                }`}
              >
                <div className="wgb-item-main">

                  {/* ICON */}

                  <div className="wgb-thumb">
                    <span>📦</span>
                  </div>

                  {/* ITEM DETAILS */}

                  <button
                    type="button"
                    className="wgb-item-description"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedId(
                        expanded ? null : item.id
                      )
                    }
                  >
                    <strong>{item.name}</strong>

                    <small>
                      {item.category} ·{" "}
                      {money(item.unitPrice)} /{" "}
                      {item.unit}
                    </small>

                    <b>
                      {money(itemTotal(item))}
                    </b>
                  </button>

                  {/* QUANTITY / DELETE */}

                  <div className="wgb-item-actions">
                    <button
                      type="button"
                      className="wgb-delete"
                      aria-label={`Remove ${item.name}`}
                        disabled={adding}
                      onClick={() =>
                        removeItem(item.id)
                      }
                    >
                      <Trash2 size={17} />
                    </button>

                    <div className="wgb-stepper">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        disabled={
                          adding || item.quantity <=
                          quantityStep(item.unit)
                        }
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            -1
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>

                      <span>
                        {Number(
                          item.quantity.toFixed(4)
                        )}{" "}
                        {item.unit}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        disabled={adding || !budgetReady ||
                          estimatedTotal - itemTotal(item) +
                            Number(item.unitPrice || 0) *
                            (Number(item.quantity) + quantityStep(item.unit)) > weeklyBudget + 0.005}
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            1
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPAND BUTTON */}

                <button
                  type="button"
                  className="wgb-details-toggle"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedId(
                      expanded ? null : item.id
                    )
                  }
                >
                  View item details & nutrition

                  {expanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {/* EXPANDED DETAILS */}

                {expanded && (
                  <div className="wgb-nutrition">
                    <div className="wgb-detail-total">
                      <span>
                        Estimated item cost
                      </span>

                      <strong>
                        {money(itemTotal(item))}
                      </strong>
                    </div>

                    {item.daysUsed?.length > 0 && (
                      <p className="wgb-footnote">
                        Used on:{" "}
                        {item.daysUsed.join(", ")}
                      </p>
                    )}

                    <p className="wgb-footnote">
                      Prices are AI estimates,
                      not verified live market prices.
                      Ingredient-level nutrition is
                      not available from the current
                      basket API. See Meal Plan for
                      meal nutrition.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ADD MORE ITEMS - BUTTON + POPUP */}
      <section className="wgb-add-panel wgb-reveal">
        <div className="wgb-section-heading">
          <div>
            <h2>Add More Items</h2>
            <p>Need something extra? Add an item and let AI estimate its price.</p>
          </div>
          <button
            type="button"
            className="wgb-primary"
            onClick={() => { setFeedback(""); setShowAddModal(true); }}
            disabled={loading || !!loadError || adding || budgetFull}
            title={budgetFull ? budgetMessage : "Add more grocery items"}
          >
            {budgetFull ? <><Wallet size={18} /> Budget Limit Reached</> : <><Plus size={18} /> Add More Items</>}
          </button>
        </div>
        {budgetFull && !loading && !loadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 14,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#FFF1F0",
              border: "1px solid #F4C7C3",
              color: "#873A38",
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {budgetReady ? "Weekly Budget Limit Reached!" : "Weekly Budget Not Set"}
              </strong>
              <span>{budgetMessage}</span>
            </div>
          </div>
        )}
      </section>

      {showAddModal && !budgetFull && (
        <div
          className="wgb-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !adding) setShowAddModal(false);
          }}
        >
          <section
            className="wgb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wgb-modal-title"
          >
            <div className="wgb-modal-header">
              <div>
                <h2 id="wgb-modal-title">Add More Items</h2>
                <p>Enter an item and let AI estimate its price.</p>
              </div>
              <button
                type="button"
                className="wgb-modal-close"
                aria-label="Close popup"
                disabled={adding}
                onClick={() => setShowAddModal(false)}
              >
                <X size={21} />
              </button>
            </div>
        <form
          className="wgb-form"
          onSubmit={addItem}
        >
          <label className="wgb-field wgb-field-full">
            <span>Item Name</span>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Onion, Soap, Milk..."
              required
            />
          </label>

          <label className="wgb-field">
            <span>Quantity</span>

            <input
              type="number"
              min={
                isWholeUnit(unit)
                  ? "1"
                  : "0.01"
              }
              step={
                isWholeUnit(unit)
                  ? "1"
                  : "any"
              }
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              required
            />
          </label>

          <label className="wgb-field">
            <span>Unit</span>

            <select
              value={unit}
              onChange={(event) =>
                setUnit(event.target.value)
              }
            >
              {[
                "kg",
                "g",
                "pcs",
                "L",
                "ml",
                "bottle",
                "dozen",
                "bunch",
              ].map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              ))}
            </select>
          </label>

          {/* AI PRICE STATUS */}

          <div className="wgb-price-preview wgb-field-full">
            <div>
              <span>AI Price Estimation</span>

              <strong>
                {adding
                  ? "AI is estimating..."
                  : "Calculated when added"}
              </strong>
            </div>

            <div>
              <span>Estimated Item Total</span>

              <strong className="wgb-green">
                {adding
                  ? "Calculating..."
                  : "Shown after AI estimate"}
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="wgb-primary wgb-field-full"
            disabled={
              !name.trim() ||
              !validQuantity ||
              adding ||
              loading ||
              !!loadError || budgetFull
            }
          >
            <Plus size={18} />

            {adding
              ? "Estimating Price..."
              : "Add to Basket"}
          </button>
        </form>

            {feedback && <p className="wgb-feedback" role="status">{typeof feedback === "string" ? feedback : "Unable to estimate price. Please try again."}</p>}
        <p className="wgb-footnote">
          New items are added only after AI
          returns a valid estimated price.
          These are not verified live prices.
        </p>
          </section>
        </div>
      )}

      {/* WEEKLY BUDGET */}

      <section className="wgb-budget-panel wgb-reveal">
        <div className="wgb-section-heading">
          <div>
            <h2>Your Weekly Budget</h2>

            <p>
              Stay on track while customizing
              your grocery basket.
            </p>
          </div>

          <span
            className={`wgb-count ${
              remaining < 0 ? "over" : ""
            }`}
          >
            {percent}% used
          </span>
        </div>

        {/* PROGRESS BAR */}

        <div
          className="wgb-progress"
          role="progressbar"
          aria-label="Budget used"
          aria-valuenow={Math.min(
            100,
            Math.max(0, percent)
          )}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            style={{
              width: `${Math.min(
                100,
                Math.max(0, percent)
              )}%`,
            }}
          />
        </div>

        {/* BUDGET CARDS */}

        <div className="wgb-budget-cards">
          <div>
            <span>Estimated Total</span>

            <strong>
              {money(estimatedTotal)}
            </strong>
          </div>

          <div>
            <span>
              {remaining < 0
                ? "Over Budget"
                : "Remaining Budget"}
            </span>

            <strong
              className={
                remaining < 0
                  ? "wgb-over"
                  : "wgb-green"
              }
            >
              {money(Math.abs(remaining))}
            </strong>
          </div>
        </div>

        {/* ACTION BUTTONS */}

        <div className="wgb-footer-actions">
          <button
            type="button"
            className="wgb-secondary"
            onClick={saveBasket}
            disabled={
              loading || saving || adding ||
              !!loadError ||
              basketId === null || !budgetReady || overBudget
            }
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save Basket"}
          </button>

          <button
            type="button"
            className="wgb-primary"
            onClick={chooseShop}
            disabled={
              loading || saving || adding ||
              !!loadError ||
              basketId === null || !budgetReady || overBudget
            }
          >
            Choose Partner Shop
            <ArrowRight size={18} />
          </button>
        </div>

        {/* SAVE SUCCESS */}

        {savedNotice && (
          <p className="wgb-success">
            <CheckCircle2 size={16} />
            Basket changes saved to MySQL. Your partner shop will receive these items.
          </p>
        )}

        {/* FEEDBACK */}

        {feedback && (
          <p
            className="wgb-feedback"
            role="status"
          >
            {feedback}
          </p>
        )}
      </section>

      {/* FOOTER */}

      <p className="wgb-bottom-note">
        MealMate · Plan Smart. Eat Healthy.
        · Prices are AI estimates, not
        live market quotations.
      </p>
    </main>
  );
}
