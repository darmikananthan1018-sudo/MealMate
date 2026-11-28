
import React, { useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Clock3,
  Package,
  CheckCircle2,
  Search,
  Store,
  CalendarDays,
  ChevronRight,
  ShoppingBasket,
  MapPin,
  ArrowRight,
  ListFilter,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import "../styles/CustomerDashboard.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const filters = [
  "All Orders",
  "Pending",
  "In Progress",
  "Completed",
];

const stages = [
  "Order Placed",
  "Accepted",
  "Preparing",
  "Ready for Pickup",
];

const stageIcons = [
  ShoppingBasket,
  Store,
  Package,
  ShoppingBag,
];

const currency = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    maximumFractionDigits: 2,
  })}`;

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token");

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDisplayStatus = (status) => {
  const value = String(status || "pending").toLowerCase();

  if (value === "pending") return "Pending";

  if (
    value === "accepted" ||
    value === "preparing" ||
    value === "ready"
  ) {
    return "In Progress";
  }

  if (value === "completed") return "Completed";
  if (value === "rejected") return "Rejected";
  if (value === "cancelled") return "Cancelled";

  return "Pending";
};

const getCompletedStages = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "pending":
      return 1;
    case "accepted":
      return 2;
    case "preparing":
      return 3;
    case "ready":
    case "completed":
      return 4;
    default:
      return 1;
  }
};

const normalizeItems = (snapshot) => {
  let basket = snapshot;

  if (typeof basket === "string") {
    try {
      basket = JSON.parse(basket);
    } catch {
      return [];
    }
  }

  if (!basket || typeof basket !== "object") {
    return [];
  }

  const rawItems =
    basket.items ||
    basket.grocery_basket?.items ||
    basket.basket_data?.items ||
    [];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(
      item.estimated_unit_price_lkr ??
      item.unit_price ??
      item.unitPrice ??
      0
    );

    const total = Number(
      item.estimated_total_price_lkr ??
      item.total_price ??
      item.backendTotal ??
      quantity * unitPrice
    );

    return {
      id: index,
      name: item.name || "Grocery Item",
      qty: `${quantity} ${item.unit || "pcs"}`,
      price: total,
    };
  });
};

const normalizeOrder = (order) => ({
  id: order.id,
  shop: order.shop_name || `Partner Shop #${order.shop_id}`,
  date: formatDate(order.created_at),
  time: formatTime(order.created_at),
  status: getDisplayStatus(order.status),
  rawStatus: String(order.status || "pending").toLowerCase(),
  total: Number(order.estimated_total_lkr || 0),
  items: normalizeItems(order.basket_snapshot),
});

async function fetchMyOrders() {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in to view your orders.");
  }

  const response = await fetch(`${API_URL}/orders/my`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Unable to load orders (${response.status}).`
    );
  }

  if (!Array.isArray(data.orders)) {
    throw new Error("Invalid orders response from backend.");
  }

  return data.orders.map(normalizeOrder);
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All Orders");
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const result = await fetchMyOrders();

      setOrders(result);

      setSelectedId((previous) => {
        if (result.some((order) => order.id === previous)) {
          return previous;
        }

        return result[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message || "Unable to load your orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const counts = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter(
        (order) => order.status === "Pending"
      ).length,
      progress: orders.filter(
        (order) => order.status === "In Progress"
      ).length,
      completed: orders.filter(
        (order) => order.status === "Completed"
      ).length,
    }),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        filter === "All Orders" ||
        order.status === filter;

      const matchesSearch =
        `${order.id} ${order.shop}`
          .toLowerCase()
          .includes(search.toLowerCase().trim());

      return matchesStatus && matchesSearch;
    });
  }, [orders, filter, search]);

  const selectedOrder =
    orders.find((order) => order.id === selectedId) ||
    orders[0] ||
    null;

  const completedStages = selectedOrder
    ? getCompletedStages(selectedOrder.rawStatus)
    : 0;

  return (
    <div className="mo-page">
      {/* HERO SECTION */}
      <section className="mo-hero">
        <div className="mo-hero-copy">
          <span className="mo-eyebrow">
            <Sparkles size={14} />
            YOUR WEEKLY GROCERY JOURNEY
          </span>

          <h1>
            <span className="mo-heading-icon">
              <ShoppingBag size={30} />
            </span>
            My <em>Orders</em>
          </h1>

          <p>
            Track and manage your weekly grocery basket
            orders with your trusted local partner shops.
          </p>

          <span className="mo-hero-note">
            <CheckCircle2 size={15} />
            Simple tracking • Local partner shops •
            Easy pickup
          </span>
        </div>

        <div className="mo-hero-art" aria-hidden="true">
          <div className="mo-art-circle" />

          <div className="mo-floating-icon mo-floating-basket">
            <ShoppingBasket size={22} />
          </div>

          <div className="mo-floating-icon mo-floating-check">
            <CheckCircle2 size={22} />
          </div>

          <span className="mo-art-leaf mo-leaf-one">
            ✦
          </span>

          <span className="mo-art-leaf mo-leaf-two">
            ✧
          </span>

          <span className="mo-store-awning">
            ▰ ▰ ▰ ▰ ▰
          </span>

          <div className="mo-store-illustration">
            <img
              src="/images/my-orders-hero.png"
              alt="MealMate My Orders"
              className="mo-hero-image"
            />

            <span>LOCAL PARTNER SHOP</span>
          </div>
        </div>
      </section>

      {/* LOADING / ERROR */}
      {loading && (
        <p className="mo-empty" role="status">
          Loading your orders...
        </p>
      )}

      {error && (
        <div className="mo-empty" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ORDER STATISTICS */}
      <section
        className="mo-stats"
        aria-label="Order summary"
      >
        <div className="mo-stat mo-stat-total">
          <span className="mo-stat-icon">
            <ShoppingBag />
          </span>

          <div>
            <strong>
              {String(counts.total).padStart(2, "0")}
            </strong>
            <span>Total Orders</span>
          </div>

          <span className="mo-stat-spark">⌁</span>
        </div>

        <div className="mo-stat mo-stat-pending">
          <span className="mo-stat-icon">
            <Clock3 />
          </span>

          <div>
            <strong>
              {String(counts.pending).padStart(2, "0")}
            </strong>
            <span>Pending Orders</span>
          </div>

          <span className="mo-stat-spark">⌁</span>
        </div>

        <div className="mo-stat mo-stat-progress">
          <span className="mo-stat-icon">
            <Package />
          </span>

          <div>
            <strong>
              {String(counts.progress).padStart(2, "0")}
            </strong>
            <span>In Progress</span>
          </div>

          <span className="mo-stat-spark">⌁</span>
        </div>

        <div className="mo-stat mo-stat-complete">
          <span className="mo-stat-icon">
            <CheckCircle2 />
          </span>

          <div>
            <strong>
              {String(counts.completed).padStart(2, "0")}
            </strong>
            <span>Completed</span>
          </div>

          <span className="mo-stat-spark">⌁</span>
        </div>
      </section>

      {/* FILTERS AND SEARCH */}
      <div className="mo-toolbar">
        <div
          className="mo-filters"
          aria-label="Filter orders"
        >
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={`mo-filter ${
                filter === item ? "is-active" : ""
              }`}
              onClick={() => setFilter(item)}
            >
              {item} (
              {item === "All Orders"
                ? counts.total
                : item === "Pending"
                ? counts.pending
                : item === "In Progress"
                ? counts.progress
                : counts.completed}
              )
            </button>
          ))}
        </div>

        <label className="mo-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search orders or shops..."
            aria-label="Search orders"
          />
        </label>

        <button
          type="button"
          onClick={() => loadOrders(true)}
          disabled={loading || refreshing}
          title="Refresh orders"
          aria-label="Refresh orders"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* ORDER LIST AND DETAILS */}
      <section className="mo-columns">
        <div
          className="mo-order-list"
          aria-label="Order history"
        >
          <div className="mo-section-heading">
            <h2>
              <ListFilter size={20} />
              Order History
            </h2>

            <span>
              {filteredOrders.length} orders found
            </span>
          </div>

          {!loading &&
            !error &&
            orders.length === 0 && (
              <div className="mo-empty">
                You haven't placed any orders yet.
              </div>
            )}

          {filteredOrders.length === 0 &&
          orders.length > 0 ? (
            <div className="mo-empty">
              No orders match your search or filter.
            </div>
          ) : (
            filteredOrders.map((order, index) => (
              <button
                type="button"
                key={order.id}
                onClick={() => {
                  setSelectedId(order.id);
                  setShowDetails(false);
                }}
                className={`mo-order-card ${
                  selectedId === order.id
                    ? "is-selected"
                    : ""
                }`}
                style={{
                  animationDelay: `${index * 90}ms`,
                }}
              >
                <span className="mo-shop-thumbnail">
                  <Store size={32} />
                  <small>LOCAL SHOP</small>
                </span>

                <span className="mo-order-main">
                  <strong>
                    Order #{order.id}
                  </strong>

                  <span>
                    <Store size={14} />
                    {order.shop}
                  </span>

                  <span>
                    <CalendarDays size={14} />
                    {order.date}
                  </span>
                </span>

                <span className="mo-order-right">
                  <span
                    className={`mo-status ${order.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {order.status === "Pending" ? (
                      <Clock3 size={14} />
                    ) : order.status === "Completed" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Package size={14} />
                    )}

                    {order.status}
                  </span>

                  <strong>
                    {currency(order.total)}
                  </strong>
                </span>

                <span className="mo-card-arrow">
                  <ChevronRight size={21} />
                </span>
              </button>
            ))
          )}
        </div>

        {/* ORDER TRACKING PANEL */}
        {selectedOrder ? (
          <aside
            className="mo-details"
            aria-label="Selected order tracking"
          >
            <div className="mo-details-heading">
              <span className="mo-details-icon">
                <ShoppingBag size={23} />
              </span>

              <div>
                <h2>
                  Order #{selectedOrder.id}
                </h2>

                <p>
                  <Store size={13} />
                  {selectedOrder.shop}
                </p>
              </div>

              <span
                className={`mo-status ${selectedOrder.status
                  .toLowerCase()
                  .replaceAll(" ", "-")}`}
              >
                {selectedOrder.status}
              </span>
            </div>

            {/* TRACKING TIMELINE */}
            <div className="mo-tracking">
              <div className="mo-track-line" />
<div
  className="mo-track-line-fill"
  style={{
    width: `${Math.max(
      0,
      Math.min(75, ((completedStages - 1) / 3) * 75)
    )}%`,
  }}
/>

              {stages.map((stage, index) => {
                const Icon = stageIcons[index];

                const isDone =
                  index < completedStages &&
                  !["rejected", "cancelled"].includes(
                    selectedOrder.rawStatus
                  );

                return (
                  <div
                    className={`mo-stage ${
                      isDone ? "done" : ""
                    }`}
                    key={stage}
                  >
                    <span className="mo-stage-icon">
                      <Icon size={21} />
                    </span>

                    <strong>{stage}</strong>

                    {index === 0 && (
                      <small>
                        {selectedOrder.date}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>

            {["rejected", "cancelled"].includes(
              selectedOrder.rawStatus
            ) && (
              <p className="mo-empty">
                This order was {selectedOrder.status.toLowerCase()}.
              </p>
            )}

            {/* BASKET SUMMARY */}
            <div className="mo-basket-panel">
              <div>
                <h3>Order Details</h3>

                <p>
                  <ShoppingBasket size={17} />
                  Weekly Grocery Basket
                </p>

                <p>
                  <Package size={17} />
                  Items: {selectedOrder.items.length}
                </p>

                <p>
                  <CalendarDays size={17} />
                  Order Date: {selectedOrder.date}
                </p>

                <p>
                  <Store size={17} />
                  Partner Shop: {selectedOrder.shop}
                </p>
              </div>

              <div
                className="mo-basket-art"
                aria-hidden="true"
              >
                🥕🥬
                <span>🧺</span>
              </div>
            </div>

            {/* TOTAL */}
            <div className="mo-total-row">
              <span>Estimated Total</span>

              <strong>
                {currency(selectedOrder.total)}
              </strong>
            </div>

            <button
              className="mo-details-button"
              type="button"
              onClick={() =>
                setShowDetails((value) => !value)
              }
            >
              {showDetails
                ? "Hide Basket Items"
                : "View Full Details"}

              <ArrowRight size={18} />
            </button>

            {/* EXPANDABLE BASKET DETAILS */}
            {showDetails && (
              <div className="mo-item-details">
                <h3>Basket Items</h3>

                {selectedOrder.items.length === 0 ? (
                  <p>
                    No basket item details are available
                    for this order.
                  </p>
                ) : (
                  selectedOrder.items.map((item) => (
                    <div
                      className="mo-item-row"
                      key={item.id}
                    >
                      <span>
                        {item.name}
                        <small>{item.qty}</small>
                      </span>

                      <strong>
                        {currency(item.price)}
                      </strong>
                    </div>
                  ))
                )}

                <p>
                  Prices are estimates. Actual partner
                  shop totals may vary.
                </p>
              </div>
            )}

            <p className="mo-pickup-note">
              <MapPin size={15} />
              Order tracking is for partner-shop pickup,
              not delivery.
            </p>
          </aside>
        ) : (
          <aside
            className="mo-details"
            aria-label="Order tracking"
          >
            <div className="mo-empty">
              Select an order to view its details.
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
