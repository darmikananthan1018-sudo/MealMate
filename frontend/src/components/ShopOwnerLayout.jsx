
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Store,
  ShoppingBasket,
  Settings,
  LogOut,
  CheckCircle2,
  UserRound,
  Bell,
} from "lucide-react";

import { getShopOwnerProfile } from "../services/api";
import "../styles/ShopOwnerDashboard.css";

const ROUTES = {
  dashboard: "/shop-owner/dashboard",
  orders: "/shop/orders",
  profile: "/shop-owner/profile",
  notifications: "/shop-owner/notifications",
  login: "/login",
};

const photoUrl = (value) => {
  if (!value) return null;

  if (value.startsWith("http")) {
    return value;
  }

  return `http://127.0.0.1:8000${value}`;
};

export default function ShopOwnerLayout({
  children,
  title = "",
  onOrdersClick,
  profile: suppliedProfile,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [owner, setOwner] = useState(
    suppliedProfile || null
  );

  // ACTIVE NAVIGATION
  const isDashboard = pathname === ROUTES.dashboard;

  const isReceivedOrders =
    pathname === ROUTES.orders ||
    pathname.startsWith(`${ROUTES.orders}/`);

  const isProfile = pathname === ROUTES.profile;

  const isNotifications =
    pathname === ROUTES.notifications;

  // UPDATE PROFILE FROM PARENT
  useEffect(() => {
    if (suppliedProfile) {
      setOwner(suppliedProfile);
    }
  }, [suppliedProfile]);

  // LOAD SHOP OWNER PROFILE
  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const response = await getShopOwnerProfile();

        if (mounted) {
          setOwner(response.data);
        }
      } catch (error) {
        console.error(
          "Unable to load shop owner navbar:",
          error
        );
      }
    };

    refresh();

    window.addEventListener(
      "mealmate:shop-profile-updated",
      refresh
    );

    return () => {
      mounted = false;

      window.removeEventListener(
        "mealmate:shop-profile-updated",
        refresh
      );
    };
  }, []);

  // NAVIGATION
  const goTo = (path) => {
    if (pathname !== path) {
      navigate(path);
    }
  };

  // RECEIVED ORDERS - SEPARATE PAGE
  const goOrders = () => {
    goTo(ROUTES.orders);
  };

  // NOTIFICATIONS
  const goNotifications = () => {
    goTo(ROUTES.notifications);
  };

  // LOGOUT
  const logout = () => {
    [
      "mealmate_token",
      "access_token",
      "token",
    ].forEach((key) => {
      localStorage.removeItem(key);
    });

    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div className="so-page">

      {/* SIDEBAR */}
      <aside className="so-sidebar">

        {/* BRAND */}
        <div className="so-brand">
          <img
            src="/images/mealmate-logo.png"
            alt="MealMate"
          />
          <span>Partner Portal</span>
        </div>

        {/* WORKSPACE */}
        <div className="so-sidebar-section">

          <p className="so-sidebar-label">
            WORKSPACE
          </p>

          {/* DASHBOARD */}
          <button
            type="button"
            className={`so-sidebar-link ${
              isDashboard ? "so-sidebar-active" : ""
            }`}
            onClick={() => goTo(ROUTES.dashboard)}
            aria-current={isDashboard ? "page" : undefined}
          >
            <Store size={19} />
            <span>Dashboard</span>
          </button>

          {/* RECEIVED ORDERS */}
          <button
            type="button"
            className={`so-sidebar-link ${
              isReceivedOrders ? "so-sidebar-active" : ""
            }`}
            onClick={goOrders}
            aria-current={
              isReceivedOrders ? "page" : undefined
            }
          >
            <ShoppingBasket size={19} />
            <span>Received Orders</span>
          </button>

          {/* MY SHOP PROFILE */}
          <button
            type="button"
            className={`so-sidebar-link ${
              isProfile ? "so-sidebar-active" : ""
            }`}
            onClick={() => goTo(ROUTES.profile)}
            aria-current={isProfile ? "page" : undefined}
          >
            <Settings size={19} />
            <span>My Shop Profile</span>
          </button>

          {/* NOTIFICATIONS */}
          <button
            type="button"
            className={`so-sidebar-link ${
              isNotifications ? "so-sidebar-active" : ""
            }`}
            onClick={goNotifications}
            aria-current={
              isNotifications ? "page" : undefined
            }
          >
            <Bell size={19} />
            <span>Notifications</span>
          </button>

        </div>

        {/* LOGOUT */}
        <div className="so-sidebar-bottom">
          <button
            type="button"
            className="so-sidebar-link"
            onClick={logout}
          >
            <LogOut size={19} />
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* MAIN CONTENT */}
      <main className="so-main">

        {/* TOP NAVBAR */}
        <header className="so-topbar">

          <div className="so-topbar-title">
            <span></span>
            <h1>{title}</h1>
          </div>

          <div className="so-topbar-right">

            {/* NOTIFICATIONS */}
            <button
              type="button"
              className={`so-notification-button ${
                isNotifications
                  ? "so-notification-active"
                  : ""
              }`}
              onClick={goNotifications}
              title="Notifications"
              aria-label="Open notifications"
            >
              <Bell size={20} />
            </button>

            {/* APPROVED PARTNER */}
            {owner?.approval_status === "approved" && (
              <span className="so-approved">
                <CheckCircle2 size={15} />
                Approved Partner
              </span>
            )}

            {/* OWNER NAME */}
            <span className="so-owner-name">
              {owner?.full_name || "Shop Owner"}
            </span>

            {/* PROFILE PHOTO */}
            <button
              type="button"
              className="so-avatar so-profile-button"
              onClick={() => goTo(ROUTES.profile)}
              title="My Shop Profile"
              aria-label="Open my shop profile"
            >
              {owner?.profile_photo ? (
                <img
                  src={photoUrl(owner.profile_photo)}
                  alt="Shop Owner"
                  className="so-profile-photo"
                />
              ) : (
                <UserRound size={19} />
              )}
            </button>

          </div>
        </header>

        {/* PAGE CONTENT */}
        {children}

      </main>
    </div>
  );
}
