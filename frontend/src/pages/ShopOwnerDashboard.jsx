
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Store,
  ShoppingBasket,
  Clock3,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  LogOut,
  Search,
  ChevronDown,
  X,
  UserRound,
  MapPin,
  Phone,
  AlertCircle,
  Bell,
  Settings,
} from "lucide-react";

import api, { getShopOwnerProfile } from "../services/api";
import "../styles/ShopOwnerDashboard.css";
import ShopOwnerLayout from "../components/ShopOwnerLayout";

// ========================================
// ORDER STATUS LABELS
// ========================================

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// ========================================
// ORDER STATUS ACTIONS
// ========================================

const STATUS_ACTIONS = {
  pending: [
    { status: "accepted", label: "Accept Order" },
    { status: "rejected", label: "Reject Order" },
  ],
  accepted: [
    { status: "preparing", label: "Start Preparing" },
    { status: "cancelled", label: "Cancel Order" },
  ],
  preparing: [
    { status: "ready", label: "Mark as Ready" },
  ],
  ready: [
    { status: "completed", label: "Complete Order" },
  ],
};

// ========================================
// HELPERS
// ========================================

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    maximumFractionDigits: 2,
  })}`;

const getItems = (order) => {
  const snapshot = order?.basket_snapshot;

  if (!snapshot) return [];

  if (Array.isArray(snapshot)) return snapshot;

  if (Array.isArray(snapshot.items)) return snapshot.items;

  if (Array.isArray(snapshot.grocery_items))
    return snapshot.grocery_items;

  if (Array.isArray(snapshot.basket_items))
    return snapshot.basket_items;

  if (snapshot.basket) {
    if (Array.isArray(snapshot.basket))
      return snapshot.basket;

    if (Array.isArray(snapshot.basket.items))
      return snapshot.basket.items;
  }

  return [];
};

const itemName = (item) =>
  item.name ||
  item.item_name ||
  item.food_name ||
  item.ingredient ||
  "Grocery Item";

const itemQuantity = (item) => {
  const quantity = item.quantity ?? item.qty ?? 1;
  const unit = item.unit || "";

  return `${quantity} ${unit}`.trim();
};

const itemPrice = (item) =>
  item.estimated_total_price_lkr ??
  item.total_price_lkr ??
  item.total_price ??
  item.estimated_price_lkr ??
  item.estimated_price ??
  item.price_lkr ??
  item.price ??
  null;

// ========================================
// SHOP OWNER DASHBOARD
// ========================================

function ShopOwnerDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ========================================
  // LOAD SHOP OWNER PROFILE & ORDERS
  // ========================================

  const loadData = async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [profileResponse, ordersResponse] =
        await Promise.all([
          getShopOwnerProfile(),
          api.get("/orders/shop/received"),
        ]);

      setProfile(profileResponse.data);

      const responseData = ordersResponse.data;

      const receivedOrders = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.orders)
        ? responseData.orders
        : [];

      setOrders(receivedOrders);
    } catch (err) {
      const status = err.response?.status;

      if (status === 401 || status === 403) {
        localStorage.removeItem("mealmate_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        navigate("/login", { replace: true });
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load shop orders. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);


  // Refresh only the Shop Owner profile when it changes.
  // Customer navbar events are intentionally not used here.
  useEffect(() => {
    let active = true;

    const refreshShopProfile = async () => {
      try {
        const response = await getShopOwnerProfile();
        if (active) setProfile(response.data);
      } catch (err) {
        console.error("Unable to refresh shop owner profile:", err);
      }
    };

    window.addEventListener(
      "mealmate:shop-profile-updated",
      refreshShopProfile
    );

    return () => {
      active = false;
      window.removeEventListener(
        "mealmate:shop-profile-updated",
        refreshShopProfile
      );
    };
  }, []);

  // ========================================
  // ORDER STATISTICS
  // ========================================

  const stats = useMemo(() => {
    return {
      total: orders.length,

      pending: orders.filter(
        (order) => order.status === "pending"
      ).length,

      active: orders.filter((order) =>
        ["accepted", "preparing", "ready"].includes(
          order.status
        )
      ).length,

      completed: orders.filter(
        (order) => order.status === "completed"
      ).length,
    };
  }, [orders]);

  // ========================================
  // SEARCH & FILTER
  // ========================================

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesFilter =
        filter === "all" || order.status === filter;

      const matchesSearch =
        !keyword ||
        String(order.id).includes(keyword) ||
        String(order.customer_id).includes(keyword) ||
        String(order.customer_name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(order.customer_phone || "").includes(keyword) ||
        String(order.status)
          .toLowerCase()
          .includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [orders, search, filter]);

  // ========================================
  // UPDATE ORDER STATUS
  // ========================================

  const updateStatus = async (order, newStatus) => {
    if (updatingId !== null) return;

    if (
      ["rejected", "cancelled"].includes(newStatus) &&
      !window.confirm(
        `Are you sure you want to ${
          newStatus === "rejected" ? "reject" : "cancel"
        } Order #${order.id}?`
      )
    ) {
      return;
    }

    setUpdatingId(order.id);
    setActionError("");

    try {
      const response = await api.patch(
        `/orders/${order.id}/status`,
        { status: newStatus }
      );

      const updated = response.data?.order;

      if (!updated) {
        throw new Error("Updated order was not returned.");
      }

      setOrders((previous) =>
        previous.map((existing) =>
          existing.id === order.id ? updated : existing
        )
      );

      setSelectedOrder((previous) =>
        previous?.id === order.id ? updated : previous
      );
    } catch (err) {
      setActionError(
        err.response?.data?.detail ||
          err.message ||
          "Could not update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ========================================
  // NEW: OPEN ITEM AVAILABILITY PAGE
  // ========================================

  const openBasketNotificationPage = (orderId) => {
    setSelectedOrder(null);

    navigate(`/shop/orders/${orderId}/details`);
  };

  // ========================================
  // LOGOUT
  // ========================================

  const logout = () => {
    localStorage.removeItem("mealmate_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");

    navigate("/login", { replace: true });
  };

  // ========================================
  // ORDER STATUS BUTTONS
  // ========================================

  const renderActions = (order) => {
    const actions = STATUS_ACTIONS[order.status] || [];

    if (actions.length === 0) return null;

    return (
      <div className="so-actions">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={updatingId !== null}
            className={
              ["rejected", "cancelled"].includes(action.status)
                ? "so-btn so-btn-danger"
                : "so-btn so-btn-primary"
            }
            onClick={() =>
              updateStatus(order, action.status)
            }
          >
            {updatingId === order.id
              ? "Updating..."
              : action.label}
          </button>
        ))}
      </div>
    );
  };

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="so-loading">
        <RefreshCw className="so-spin" size={28} />
        <p>Loading your partner shop dashboard...</p>
      </div>
    );
  }

  // ========================================
  // MAIN UI
  // ========================================

  return (
    <>
      <ShopOwnerLayout
        profile={profile}
        onOrdersClick={() => {
          navigate("/shop/orders");
        }}
      >
        <div className="so-content">

          {/* WELCOME SECTION */}

          <section className="so-welcome">
            <div>
              <span className="so-eyebrow">
                MEALMATE PARTNER NETWORK
              </span>

              <h2>
                Welcome back,{" "}
                {profile?.shop_name ||
                  profile?.full_name ||
                  "Shop Owner"}!
              </h2>

              <p>
                Manage customer grocery baskets and keep
                every order moving smoothly.
              </p>
            </div>

            <div className="so-welcome-icon">
              <Store size={44} strokeWidth={1.5} />
            </div>
          </section>

          {/* ORDER STATISTICS */}

          <section className="so-stats">

            <div className="so-stat-card">
              <div className="so-stat-icon purple">
                <ShoppingBasket size={22} />
              </div>

              <span>Total Orders</span>
              <strong>{stats.total}</strong>
              <small>All received baskets</small>
            </div>

            <div className="so-stat-card">
              <div className="so-stat-icon yellow">
                <Clock3 size={22} />
              </div>

              <span>Pending Orders</span>
              <strong>{stats.pending}</strong>
              <small>Waiting for your response</small>
            </div>

            <div className="so-stat-card">
              <div className="so-stat-icon lime">
                <PackageCheck size={22} />
              </div>

              <span>In Progress</span>
              <strong>{stats.active}</strong>
              <small>Accepted, preparing or ready</small>
            </div>

            <div className="so-stat-card">
              <div className="so-stat-icon green">
                <CheckCircle2 size={22} />
              </div>

              <span>Completed</span>
              <strong>{stats.completed}</strong>
              <small>Successfully completed</small>
            </div>
          </section>

          <div className="so-dashboard-orders-link">
            <button type="button" className="so-btn so-btn-primary"
              onClick={() => navigate("/shop/orders")}
            >
              <ShoppingBasket size={18} /> View Received Orders
            </button>
          </div>

          {/* ERRORS */}

          {error && (
            <div className="so-alert">
              <AlertCircle size={19} />
              <span>{error}</span>

              <button
                type="button"
                onClick={() => loadData()}
              >
                Retry
              </button>
            </div>
          )}

          {actionError && (
            <div className="so-alert">
              <AlertCircle size={19} />
              <span>{actionError}</span>

              <button
                type="button"
                onClick={() => setActionError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {/* FOOTER */}

          <footer className="so-footer">
            © MealMate Partner Portal · Plan Smart.
            Eat Healthy.
          </footer>
        </div>
      </ShopOwnerLayout>


    </>
  );
}

export default ShopOwnerDashboard;
