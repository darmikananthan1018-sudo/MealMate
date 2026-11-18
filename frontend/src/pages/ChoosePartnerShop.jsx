
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Store,
  Search,
  MapPin,
  Phone,
  Check,
  ShoppingBasket,
  Wallet,
  Tag,
  Send,
  ArrowLeft,
  ShieldCheck,
  Handshake,
  Sprout,
  Coins,
  List,
  ChevronRight,
  AlertCircle,
  Clock3,
  X,
  Sparkles,
} from "lucide-react";

import "../styles/CustomerDashboard.css";

// ========================================
// API CONFIGURATION
// ========================================

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("mealmate_token") ||
    localStorage.getItem("access_token")
  );
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Please login to continue.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status}).`
    );
  }

  return data;
}

// ========================================
// FORMAT HELPERS
// ========================================

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    maximumFractionDigits: 2,
  })}`;

function groceryEmoji(name = "") {
  const value = String(name).toLowerCase();

  if (value.includes("rice")) return "🍚";
  if (value.includes("dhal") || value.includes("dal"))
    return "🫘";
  if (value.includes("carrot")) return "🥕";
  if (value.includes("banana")) return "🍌";
  if (value.includes("egg")) return "🥚";
  if (value.includes("milk")) return "🥛";
  if (value.includes("tomato")) return "🍅";
  if (value.includes("onion")) return "🧅";
  if (value.includes("potato")) return "🥔";
  if (value.includes("apple")) return "🍎";

  return "🛒";
}

function getShopLocation(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1
    ? parts[parts.length - 1]
    : "Other Locations";
}

function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function normalizeShops(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.shops)
      ? data.shops
      : [];

  return list
    .filter((shop) => shop.approval_status === "approved")
    .map((shop) => ({
      id: Number(shop.id),
      name: shop.shop_name || "Partner Shop",
      address: shop.address || "Address not provided",
      phone: shop.phone || "Not provided",
      location: getShopLocation(shop.address),
      logo: assetUrl(shop.shop_logo),
      cover: assetUrl(shop.shop_cover_photo),
      description: shop.shop_description || "",
      openingHours: shop.opening_hours || "",
      offers: (Array.isArray(shop.offers) ? shop.offers : []).filter(
        (offer) => {
          if (!offer.is_active) return false;
          const today = new Date().toLocaleDateString("en-CA");
          const start = offer.start_date?.slice(0, 10);
          const end = offer.end_date?.slice(0, 10);
          return (!start || start <= today) && (!end || end >= today);
        }
      ),
      highlights: (Array.isArray(shop.highlights) ? shop.highlights : [])
        .filter((highlight) => highlight.is_selected)
        .map((highlight) => highlight.title)
        .filter(Boolean),
    }));
}

function offerLabel(offer) {
  if (offer.offer_type === "percentage") return `${offer.amount}% OFF`;
  if (offer.offer_type === "fixed") return `${money(offer.amount)} OFF`;
  return "Special Promotion";
}

function normalizeBasketItems(data) {
  const raw = data?.grocery_basket;

  const items = Array.isArray(raw?.items)
    ? raw.items
    : [];

  return items.map((item, index) => ({
    id: item.id ?? index,
    name: item.name || "Grocery Item",
    quantity: Number(item.quantity || 0),
    unit: item.unit || "",
    unitPrice:
      item.estimated_unit_price_lkr == null
        ? null
        : Number(item.estimated_unit_price_lkr),
    totalPrice:
      item.estimated_total_price_lkr == null
        ? null
        : Number(item.estimated_total_price_lkr),
  }));
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function ChoosePartnerShop({
  weeklyBudget,
}) {
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [basket, setBasket] = useState([]);
  const [basketId, setBasketId] = useState(null);
  const [basketTotal, setBasketTotal] = useState(0);
  const [savedBudget, setSavedBudget] = useState(null);
  const [showAllItems, setShowAllItems] = useState(false);

  const [search, setSearch] = useState("");
  const [location, setLocation] =
    useState("All Locations");

  const [selectedShopId, setSelectedShopId] =
    useState(null);
  const [detailsShopId, setDetailsShopId] = useState(null);

  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [createdOrderId, setCreatedOrderId] =
    useState(null);

  // ========================================
  // LOAD REAL BACKEND DATA
  // ========================================

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setNotice("");
      setSuccess(false);

      const results = await Promise.allSettled([
        apiRequest("/partner-shops"),
        apiRequest("/meal-plan/me/grocery-basket"),
        apiRequest("/food-preferences/me"),
      ]);

      if (!active) return;

      const [shopsResult, basketResult, preferencesResult] = results;
      const errors = [];

      // Partner shops
      if (shopsResult.status === "fulfilled") {
        setShops(normalizeShops(shopsResult.value));
      } else {
        setShops([]);
        errors.push(
          `Could not load partner shops: ${
            shopsResult.reason.message
          }`
        );
      }

      // Grocery basket
      if (basketResult.status === "fulfilled") {
        const data = basketResult.value;

        setBasketId(data.id ?? null);
        setBasket(normalizeBasketItems(data));
        setBasketTotal(
          Number(data.estimated_total_lkr || 0)
        );
      } else {
        setBasketId(null);
        setBasket([]);
        setBasketTotal(0);

        errors.push(
          `Could not load grocery basket: ${
            basketResult.reason.message
          }`
        );
      }
      if (preferencesResult?.status === "fulfilled") {
        const budget = Number(preferencesResult.value?.weekly_budget);
        setSavedBudget(Number.isFinite(budget) && budget > 0 ? budget : null);
      } else {
        setSavedBudget(null);
      }
      if (errors.length > 0) {
        setNotice(errors.join(" "));
      }

      setLoading(false);
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // LOCATION FILTER
  // ========================================

  const locations = useMemo(
    () => [
      "All Locations",
      ...new Set(
        shops
          .map((shop) => shop.location)
          .filter(Boolean)
      ),
    ],
    [shops]
  );

  // ========================================
  // SEARCH FILTER
  // ========================================

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const query = search.trim().toLowerCase();

      const locationMatch =
        location === "All Locations" ||
        shop.location === location;

      const searchMatch =
        !query ||
        `${shop.name} ${shop.address} ${shop.location}`
          .toLowerCase()
          .includes(query);

      return locationMatch && searchMatch;
    });
  }, [shops, search, location]);

  // ========================================
  // BASKET SUMMARY
  // ========================================

  const total = basketTotal;

  const pending = basket.filter(
    (item) => item.unitPrice == null
  ).length;

  const actualBudget = savedBudget ?? (Number(weeklyBudget) > 0 ? Number(weeklyBudget) : null);
  const budgetRemaining = actualBudget == null ? null : actualBudget - total;

  const previewItems = showAllItems ? basket : basket.slice(0, 5);

  const selectedShop = shops.find(
    (shop) => shop.id === selectedShopId
  );
  const detailsShop = shops.find((shop) => shop.id === detailsShopId);

  // ========================================
  // SEND BASKET TO SELECTED SHOP
  // ========================================

  const sendBasket = async () => {
    if (!selectedShop) {
      setSuccess(false);
      setNotice("Please select a partner shop first.");
      return;
    }

    if (!basketId || basket.length === 0) {
      setSuccess(false);
      setNotice(
        "Your saved grocery basket is empty. Generate a weekly grocery basket first."
      );
      return;
    }

    if (sending || createdOrderId) return;

    setSending(true);
    setNotice("");
    setSuccess(false);

    try {
      const response = await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          grocery_basket_id: basketId,
          shop_id: selectedShop.id,
        }),
      });

      const orderId = response?.order?.id;

      if (!orderId) {
        throw new Error(
          "Order response did not include an order ID."
        );
      }

      setCreatedOrderId(orderId);
      setSuccess(true);

      setNotice(
        `Your grocery basket was successfully sent to ${selectedShop.name}. Order #${orderId} has been created.`
      );
    } catch (error) {
      setSuccess(false);
      setNotice(
        error.message ||
          "Could not send your basket. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  // ========================================
  // JSX UI
  // ========================================

  return (
    <main className="cps-page">
      {/* HERO SECTION */}
      <section className="cps-new-hero">
        <div className="cps-new-hero-content">
          <div className="cps-new-hero-badge">
            <Store size={17} />
            <span>YOUR LOCAL GROCERY PARTNERS</span>
          </div>

          <h1 className="cps-new-hero-title">
            <Store
              className="cps-new-title-icon"
              size={42}
            />

            <span>
              Choose Your{" "}
              <span className="cps-new-highlight">
                Partner Shop
                <span className="cps-new-underline" />
              </span>
            </span>

            <Sprout
              className="cps-new-leaf"
              size={32}
            />
          </h1>

          <p className="cps-new-hero-description">
            Select a trusted local shop to send your
            weekly grocery basket.
          </p>

          <div className="cps-new-hero-features">
            <div className="cps-new-feature">
              <Store size={20} />
              <span>Local & Trusted Shops</span>
            </div>

            <div className="cps-new-feature">
              <MapPin size={20} />
              <span>Find Local Shops</span>
            </div>

            <div className="cps-new-feature">
              <ShieldCheck size={20} />
              <span>Approved Partners</span>
            </div>
          </div>
        </div>

        <div className="cps-new-hero-visual">
          <div className="cps-new-hero-circle" />

          <div className="cps-new-floating cps-new-floating-basket">
            <ShoppingBasket size={25} />
          </div>

          <div className="cps-new-floating cps-new-floating-location">
            <MapPin size={25} />
          </div>

          <div className="cps-new-floating cps-new-floating-trust">
            <Handshake size={25} />
          </div>

          <img
            src="/images/partner-shop-hero.png"
            alt="MealMate Local Partner Shop"
            className="cps-new-hero-image"
          />
        </div>
      </section>

      <div className="cps-content">
        {/* SEARCH AND LOCATION */}
        <div className="cps-search-row">
          <label className="cps-search">
            <Search size={21} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search shop by name or location..."
            />
          </label>

          <label className="cps-location">
            <MapPin size={20} />

            <select
              value={location}
              onChange={(event) =>
                setLocation(event.target.value)
              }
            >
              {locations.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cps-columns">
          {/* PARTNER SHOP CARDS */}
          <section className="cps-shop-section">
            <div className="cps-section-title">
              <h2>
                <Store size={25} />
                Available Partner Shops
              </h2>

              <span>
                {filteredShops.length} Shops Found
              </span>
            </div>

            <div className="cps-shop-list">
              {loading && (
                <p className="cps-empty">
                  Loading approved partner shops...
                </p>
              )}

              {!loading &&
                filteredShops.length === 0 && (
                  <p className="cps-empty">
                    No approved partner shops match your search.
                  </p>
                )}

              {!loading &&
                filteredShops.map((shop) => (
                  <div key={shop.id} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={`cps-shop-card ${
                      selectedShopId === shop.id
                        ? "is-selected"
                        : ""
                    }`}
                    onClick={() => {
                      if (createdOrderId) return;

                      setSelectedShopId(shop.id);
                      setNotice("");
                      setSuccess(false);
                    }}
                    aria-pressed={
                      selectedShopId === shop.id
                    }
                    disabled={Boolean(createdOrderId)}
                  >
                    <span
                      className="cps-shop-photo"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {shop.logo ? (
                        <img
                          src={shop.logo}
                          alt={`${shop.name} logo`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : (
                        <Store size={38} />
                      )}
                    </span>

                    <span className="cps-shop-info">
                      <strong>{shop.name}</strong>

                      <span className="cps-detail">
                        <MapPin size={17} />
                        {shop.address}
                      </span>

                      <span className="cps-detail">
                        <Phone size={17} />
                        {shop.phone}
                      </span>

                      {shop.openingHours && (
                        <span className="cps-detail">
                          <Clock3 size={16} />
                          {shop.openingHours}
                        </span>
                      )}
                      <span className="cps-detail">
                        <ShieldCheck size={16} />
                        Approved Partner Shop
                      </span>
                    </span>

                    <span className="cps-select-circle">
                      {selectedShopId === shop.id && (
                        <Check size={18} />
                      )}
                    </span>

                    <span
                      className="cps-card-leaf"
                      aria-hidden="true"
                    >
                      ❧
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsShopId(shop.id)}
                    style={{ marginTop: 8, marginBottom: 12, padding: "9px 14px", border: "1px solid #ddd4f1", borderRadius: 9, background: "#f5f1fc", color: "#5030a0", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
                  >
                    <Store size={15} /> View Shop Details
                  </button>
                  </div>
                ))}
            </div>
          </section>

          {/* BASKET SUMMARY */}
          <aside className="cps-summary-new" style={{ minWidth: 0, alignSelf: "start" }}>
            {/* HEADER */}
            <div className="cps-summary-new-header">
              <div className="cps-summary-new-heading">
                <span className="cps-summary-new-icon">
                  <ShoppingBasket size={26} />
                </span>

                <div>
                  <h2>
                    Your Basket <span>Summary</span>
                  </h2>

                  <p>
                    Overview of your weekly grocery basket
                  </p>
                </div>
              </div>

              <div className="cps-summary-header-decor">
                🥬 🥕
              </div>
            </div>

            <div className="cps-summary-new-body">
              {/* FOUR SUMMARY CARDS */}
              <div className="cps-summary-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div className="cps-summary-stat lavender">
                  <span className="cps-summary-stat-icon">
                    <ShoppingBasket size={22} />
                  </span>

                  <div>
                    <p>Total Items</p>
                    <strong>
                      {basket.length} items
                    </strong>
                  </div>
                </div>

                <div className="cps-summary-stat peach">
                  <span className="cps-summary-stat-icon">
                    <Tag size={22} />
                  </span>

                  <div>
                    <p>Estimated Total</p>
                    <strong>{money(total)}</strong>
                  </div>
                </div>

                <div className="cps-summary-stat purple">
                  <span className="cps-summary-stat-icon">
                    <Wallet size={22} />
                  </span>

                  <div>
                    <p>Your Weekly Budget</p>
                    <strong>
                      {actualBudget == null ? "Not available" : money(actualBudget)}
                    </strong>
                  </div>
                </div>

                <div className="cps-summary-stat green">
                  <span className="cps-summary-stat-icon">
                    <Coins size={22} />
                  </span>

                  <div>
                    <p>
                      {budgetRemaining != null && budgetRemaining < 0
                        ? "Over Budget"
                        : "Budget Remaining"}
                    </p>

                    <strong>
                      {budgetRemaining == null ? "—" : money(Math.abs(budgetRemaining))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ITEMS PREVIEW */}
              <div className="cps-summary-preview">
                <div className="cps-summary-preview-heading">
                  <List size={20} />

                  <h3>Basket Items (Preview)</h3>

                  <span>🌱</span>
                </div>

                <div className="cps-summary-preview-list">
                  {previewItems.length === 0 && (
                    <p className="cps-empty">
                      Your grocery basket is empty.
                    </p>
                  )}

                  {previewItems.map((item, index) => (
                    <div
                      className="cps-summary-preview-item"
                      key={item.id ?? index}
                    >
                      <div className="cps-summary-preview-left">
                        <span className="cps-summary-item-emoji">
                          {groceryEmoji(item.name)}
                        </span>

                        <div>
                          <strong>{item.name}</strong>

                          <small>
                            {item.quantity} {item.unit}
                          </small>
                        </div>
                      </div>

                      <span className="cps-summary-item-price">
                        {item.totalPrice != null
                          ? money(item.totalPrice)
                          : item.unitPrice == null
                            ? "Price pending"
                            : money(
                                item.unitPrice *
                                  Number(item.quantity || 0)
                              )}
                      </span>
                    </div>
                  ))}

                  {basket.length > 5 && (
                    <button type="button" className="cps-summary-more"
                      onClick={() => setShowAllItems(value => !value)}
                      aria-expanded={showAllItems}
                      style={{ width: "100%", cursor: "pointer", border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                      {showAllItems ? "Show Less" : `+ ${basket.length - 5} more items`}
                      <ChevronRight size={18} style={{ transform: showAllItems ? "rotate(-90deg)" : "rotate(90deg)" }} />
                    </button>
                  )}
                </div>
              </div>

              {/* PRICE WARNING */}
              {pending > 0 && (
                <p className="wgb-warning">
                  <AlertCircle size={16} />
                  {pending} item(s) have pending prices.
                  Estimated total may be incomplete.
                </p>
              )}

              {/* SEND BASKET BUTTON */}
              <button
                type="button"
                className="cps-summary-send-btn"
                onClick={sendBasket}
                disabled={
                  sending ||
                  loading ||
                  Boolean(createdOrderId)
                }
              >
                {createdOrderId ? (
                  <Check size={19} />
                ) : (
                  <Send size={19} />
                )}

                {sending
                  ? "Sending Basket..."
                  : createdOrderId
                    ? "Basket Sent Successfully"
                    : "Send Basket to Selected Shop"}

                <ChevronRight size={20} />
              </button>

              {/* NOTICE */}
              {notice && (
                <p
                  className="cps-notice"
                  role="status"
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: success
                      ? "#edf8ef"
                      : "#f7eff7",
                    color: success
                      ? "#23613b"
                      : "#57234f",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  {notice}
                </p>
              )}

              {/* BACK BUTTON */}
              <button
                type="button"
                className="cps-summary-back-btn"
                onClick={() =>
                  navigate("/weekly-grocery-basket")
                }
              >
                <ArrowLeft size={17} />
                Back to Grocery Basket
              </button>
            </div>
          </aside>
        </div>
      </div>

      {detailsShop && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsShopId(null);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(27,18,48,.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${detailsShop.name} details`}
            style={{ width: "100%", maxWidth: 650, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, position: "relative", boxShadow: "0 22px 70px rgba(0,0,0,.2)" }}
          >
            <button
              type="button"
              onClick={() => setDetailsShopId(null)}
              aria-label="Close shop details"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 2, background: "white", border: "none", borderRadius: 50, padding: 9, cursor: "pointer" }}
            ><X size={21} /></button>

            <div style={{ height: 175, background: "#f0ebfa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {detailsShop.cover ? (
                <img src={detailsShop.cover} alt={`${detailsShop.name} cover`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Store size={58} color="#8063d0" />
              )}
            </div>

            <div style={{ padding: 25 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {detailsShop.logo ? (
                  <img src={detailsShop.logo} alt="Shop logo" style={{ width: 58, height: 58, objectFit: "cover", borderRadius: 12 }} />
                ) : (
                  <Store size={36} color="#5030a0" />
                )}
                <div>
                  <h2 style={{ margin: 0 }}>{detailsShop.name}</h2>
                  <span style={{ color: "#39744b", fontSize: 13 }}><ShieldCheck size={14} style={{ verticalAlign: "middle" }} /> Approved Partner</span>
                </div>
              </div>

              {detailsShop.description && <p style={{ lineHeight: 1.7, color: "#605a70" }}>{detailsShop.description}</p>}
              <p><MapPin size={16} style={{ verticalAlign: "middle" }} /> {detailsShop.address}</p>
              <p><Phone size={16} style={{ verticalAlign: "middle" }} /> {detailsShop.phone}</p>
              {detailsShop.openingHours && <p><Clock3 size={16} style={{ verticalAlign: "middle" }} /> {detailsShop.openingHours}</p>}

              <h3 style={{ marginTop: 24, color: "#5030a0" }}><Tag size={18} style={{ verticalAlign: "middle" }} /> Active Offers</h3>
              {detailsShop.offers.length ? detailsShop.offers.map((offer) => (
                <div key={offer.id} style={{ padding: 13, background: "#f7f3ff", borderRadius: 10, marginBottom: 9 }}>
                  <strong>{offer.title}</strong> — {offerLabel(offer)}
                  {offer.description && <p style={{ marginBottom: 0 }}>{offer.description}</p>}
                </div>
              )) : <p style={{ color: "#827b94" }}>No active offers available.</p>}

              <h3 style={{ marginTop: 24, color: "#5030a0" }}><Sparkles size={18} style={{ verticalAlign: "middle" }} /> Shop Highlights</h3>
              {detailsShop.highlights.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {detailsShop.highlights.map((title, index) => (
                    <span key={`${title}-${index}`} style={{ background: "#eef6e6", color: "#42652e", borderRadius: 20, padding: "8px 12px", fontSize: 13 }}>
                      <Check size={14} style={{ verticalAlign: "middle" }} /> {title}
                    </span>
                  ))}
                </div>
              ) : <p style={{ color: "#827b94" }}>No highlights available.</p>}

              <button
                type="button"
                disabled={Boolean(createdOrderId)}
                onClick={() => {
                  setSelectedShopId(detailsShop.id);
                  setDetailsShopId(null);
                  setNotice("");
                  setSuccess(false);
                }}
                style={{ marginTop: 26, padding: "13px 18px", background: "#5030a0", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                {selectedShopId === detailsShop.id ? "Selected Shop" : "Select This Shop"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
