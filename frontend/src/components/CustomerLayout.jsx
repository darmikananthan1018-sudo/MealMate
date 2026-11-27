
import React, { useEffect, useState } from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  Settings,
  CalendarDays,
  ShoppingBasket,
  ShoppingCart,
  X,
  Leaf,
  Clock3,
  Sparkles,
  Bell,
  UserRound,
  LogOut,
  Menu,
  ArrowRight,
} from "lucide-react";

import { getCustomerProfile } from "../services/api";

import "../styles/CustomerDashboard.css";

// ========================================
// ROUTES
// ========================================

const ROUTES = {
  dashboard: "/customer/dashboard",
  preferences: "/food-preferences",
  mealPlan: "/meal-plan",
  basket: "/weekly-grocery-basket",
  shops: "/choose-partner-shop",
  orders: "/my-orders",
  subscription: "/premium-plans",

  // UPDATED CUSTOMER NOTIFICATION ROUTE
  notifications: "/customer/notifications",

  profile: "/my-profile",
  login: "/login",
};

// ========================================
// SIDEBAR MENU ITEMS
// ========================================

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: ROUTES.dashboard,
  },
  {
    label: "Food Preferences",
    icon: Settings,
    path: ROUTES.preferences,
  },
  {
    label: "Meal Plan",
    icon: CalendarDays,
    path: ROUTES.mealPlan,
  },
  {
    label: "Weekly Grocery Basket",
    icon: ShoppingBasket,
    path: ROUTES.basket,
  },
  {
    label: "Choose Partner Shop",
    icon: Leaf,
    path: ROUTES.shops,
  },
  {
    label: "My Orders",
    icon: Clock3,
    path: ROUTES.orders,
  },
  {
    label: "Premium Plans",
    icon: Sparkles,
    path: ROUTES.subscription,
  },
  {
    label: "Notifications",
    icon: Bell,
    path: ROUTES.notifications,
  },
  {
    label: "My Profile",
    icon: UserRound,
    path: ROUTES.profile,
  },
];

// ========================================
// CUSTOMER LAYOUT
// ========================================

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [customer, setCustomer] =
    useState(null);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartSnapshot, setCartSnapshot] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mealmate_cart_preview") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const refreshCart = (event) => {
      if (event?.detail) {
        setCartSnapshot(event.detail);
        return;
      }
      try {
        setCartSnapshot(JSON.parse(localStorage.getItem("mealmate_cart_preview") || "null"));
      } catch {
        setCartSnapshot(null);
      }
    };
    window.addEventListener("mealmate:cart-updated", refreshCart);
    window.addEventListener("storage", refreshCart);
    return () => {
      window.removeEventListener("mealmate:cart-updated", refreshCart);
      window.removeEventListener("storage", refreshCart);
    };
  }, []);

  const cartItems = cartSnapshot?.items || [];
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const cartMoney = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ========================================
  // LOAD LOGGED-IN CUSTOMER
  // ========================================

  useEffect(() => {
    let active = true;

    const token =
      localStorage.getItem("mealmate_token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token");

    if (!token) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    async function loadCustomer() {
      try {
        const response = await getCustomerProfile();

        if (active) {
          setCustomer(response.data);
        }
      } catch (error) {
        if (!active) return;

        console.error(
          "Customer loading error:",
          error
        );

        if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          localStorage.removeItem("mealmate_token");
          localStorage.removeItem("access_token");
          localStorage.removeItem("token");

          navigate(ROUTES.login, {
            replace: true,
          });
        }
      }
    }

    loadCustomer();

    return () => {
      active = false;
    };
  }, [navigate]);

  // ========================================
  // CLOSE MOBILE SIDEBAR ON NAVIGATION
  // ========================================

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // ========================================
  // UPDATE CUSTOMER PROFILE EVENT
  // ========================================

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail) {
        setCustomer((previous) => ({
          ...previous,
          ...event.detail,
        }));
      }
    };

    window.addEventListener(
      "mealmate:profile-updated",
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        "mealmate:profile-updated",
        handleProfileUpdated
      );
    };
  }, []);

  // ========================================
  // NAVIGATION
  // ========================================

  const goTo = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  // ========================================
  // LOGOUT
  // ========================================

  const logout = () => {
    localStorage.removeItem("mealmate_cart_preview");
    localStorage.removeItem("mealmate_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");

    navigate(ROUTES.login, {
      replace: true,
    });
  };

  // ========================================
  // CUSTOMER NAME
  // ========================================

  const firstName =
    customer?.full_name?.split(" ")[0] ||
    "Customer";

  const userInitial =
    firstName.charAt(0).toUpperCase();

  // ========================================
  // UI
  // ========================================

  return (
    <div className="mm-dashboard">

      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <div
          className="mm-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ===================================
          CUSTOMER SIDEBAR
      =================================== */}

      <aside
        className={`mm-sidebar ${
          sidebarOpen ? "mm-sidebar-open" : ""
        }`}
      >

        {/* LOGO */}

        <button
          type="button"
          className="mm-brand"
          onClick={() => goTo(ROUTES.dashboard)}
          aria-label="Go to MealMate Dashboard"
          style={{
            background: "transparent",
            border: "none",
            width: "100%",
          }}
        >
          <img
            src="/images/mealmate-logo.png"
            alt="MealMate Logo"
            className="mm-dashboard-logo"
          />
        </button>

        {/* MENU HEADING */}

        <div className="mm-menu-heading">
          MAIN MENU
        </div>

        {/* SIDEBAR NAVIGATION */}

        <nav className="mm-navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              location.pathname === item.path;

            return (
              <button
                type="button"
                key={item.label}
                className={`mm-nav-item ${
                  isActive ? "active" : ""
                }`}
                onClick={() => goTo(item.path)}
                aria-current={
                  isActive ? "page" : undefined
                }
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="mm-sidebar-bottom">

          <div className="mm-help-card">
            <Sparkles size={22} />

            <strong>
              Eat better every week!
            </strong>

            <p>
              Discover healthy meals planned
              just for you.
            </p>

            <button
              type="button"
              onClick={() => goTo(ROUTES.mealPlan)}
            >
              Explore Plans
              <ArrowRight size={15} />
            </button>
          </div>

          {/* LOGOUT */}

          <button
            type="button"
            className="mm-nav-item mm-logout"
            onClick={logout}
          >
            <LogOut size={19} />
            <span>Logout</span>
          </button>

        </div>
      </aside>

      {/* ===================================
          MAIN CONTENT AREA
      =================================== */}

      <div className="mm-main">

        {/* TOP NAVBAR */}

        <header className="mm-topbar">

          <div className="mm-topbar-left">

            <button
              type="button"
              className="mm-menu-toggle"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open menu"
            >
              <Menu size={23} />
            </button>

          </div>

          {/* TOP RIGHT ACTIONS */}

          <div className="mm-topbar-actions">

            {/* READ-ONLY GROCERY CART */}
            <button
              type="button"
              className="mm-icon-button mm-cart-trigger"
              aria-label={`View grocery cart, ${cartItems.length} items`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart size={21} />
              {cartItems.length > 0 && <span className="mm-cart-count">{cartItems.length}</span>}
            </button>

            {/* NOTIFICATIONS */}

            <button
              type="button"
              className="mm-icon-button"
              aria-label="Notifications"
              onClick={() =>
                goTo(ROUTES.notifications)
              }
            >
              <Bell size={21} />
            </button>

            {/* CUSTOMER PROFILE */}

            <button
              type="button"
              className="mm-user"
              onClick={() =>
                goTo(ROUTES.profile)
              }
            >
              <span className="mm-avatar">
                {customer?.profile_photo ? (
                  <img
                    src={`http://127.0.0.1:8000${customer.profile_photo}`}
                    alt="My Profile"
                    className="mm-navbar-avatar-image"
                  />
                ) : (
                  userInitial
                )}
              </span>

              <span className="mm-user-details">
                <strong>
                  {customer?.full_name || "Customer"}
                </strong>
                <small>Customer</small>
              </span>
            </button>

          </div>
        </header>

        {/* READ-ONLY CART POPUP */}
        {cartOpen && (
          <div className="mm-cart-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}>
            <section className="mm-cart-panel" role="dialog" aria-modal="true" aria-label="My Grocery Basket">
              <div className="mm-cart-header">
                <div>
                  <h2>My Grocery Basket</h2>
                  <p>{cartItems.length} items in your basket</p>
                </div>
                <button type="button" className="mm-cart-close" aria-label="Close cart" onClick={() => setCartOpen(false)}>
                  <X size={21} />
                </button>
              </div>
              <div className="mm-cart-items">
                {cartItems.length === 0 ? (
                  <p className="mm-cart-empty">No grocery items yet. Open Weekly Grocery Basket to view your list.</p>
                ) : cartItems.map((item) => (
                  <div className="mm-cart-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.quantity} {item.unit}</small>
                    </div>
                    <strong>{cartMoney(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="mm-cart-footer">
                <span>Estimated Total</span>
                <strong>{cartMoney(cartTotal)}</strong>
              </div>
            </section>
          </div>
        )}

        {/* PAGE CONTENT */}

        <main className="mm-content">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
