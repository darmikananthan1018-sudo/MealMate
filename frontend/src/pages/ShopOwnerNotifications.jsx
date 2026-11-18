
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Bell,
  CheckCheck,
  RefreshCw,
  ShoppingBasket,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import ShopOwnerLayout from "../components/ShopOwnerLayout";

import "../styles/ShopOwnerDashboard.css";


// ==========================================
// API CONFIGURATION
// ==========================================

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

// ==========================================
// SHOP OWNER NOTIFICATIONS
// ==========================================

function ShopOwnerNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [updatingId, setUpdatingId] =
    useState(null);

  // ==========================================
  // API REQUEST
  // ==========================================

  const request = useCallback(async (path, options = {}) => {
    const token =
      localStorage.getItem("mealmate_token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Session expired. Please login again."
      );
    }

    const response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Unable to complete request."
      );
    }

    return data;
  }, []);

  // ==========================================
  // LOAD NOTIFICATIONS
  // ==========================================

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await request(
        "/notifications/my"
      );

      const notificationList =
        Array.isArray(data)
          ? data
          : Array.isArray(data.notifications)
          ? data.notifications
          : [];

      setNotifications(notificationList);

    } catch (err) {
      setError(
        err.message ||
        "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ==========================================
  // MARK NOTIFICATION AS READ
  // ==========================================

  const markAsRead = async (id) => {
    try {
      setUpdatingId(id);
      setError("");

      await request(
        `/notifications/${id}/read`,
        {
          method: "PATCH",
        }
      );

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to update notification."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================
  // NOTIFICATION COUNTS
  // ==========================================

  const totalCount = notifications.length;

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  // ==========================================
  // OPEN ORDER DETAILS
  // ==========================================

  const openOrder = (orderId) => {
    navigate(
      `/shop/orders/${orderId}/details`
    );
  };

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <ShopOwnerLayout title="Notifications">

      <div className="son-page">

        {/* PAGE HEADER */}

        <div className="son-header">

          <div>
            <h1>
              <Bell size={25} />
              Notifications
            </h1>

            <p>
              Stay updated on your MealMate
              partner shop activities.
            </p>
          </div>

          <button
            type="button"
            className="son-refresh"
            onClick={loadNotifications}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>

        {/* SUMMARY CARDS */}

        <div className="son-summary">

          <div>
            <span>Total Notifications</span>
            <strong>{totalCount}</strong>
          </div>

          <div>
            <span>Unread Notifications</span>
            <strong>{unreadCount}</strong>
          </div>

        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="son-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING STATE */}

        {loading ? (

          <div className="son-empty">
            <RefreshCw size={28} />
            <h3>Loading Notifications...</h3>
            <p>Please wait a moment.</p>
          </div>

        ) : notifications.length === 0 ? (

          /* EMPTY STATE */

          <div className="son-empty">
            <Bell size={30} />

            <h3>No Notifications Yet</h3>

            <p>
              Your new shop notifications
              will appear here.
            </p>
          </div>

        ) : (

          /* NOTIFICATION LIST */

          <div className="son-list">

            {notifications.map((notification) => (

              <article
                key={notification.id}
                className={`son-card ${
                  !notification.is_read
                    ? "son-unread"
                    : ""
                }`}
              >

                {/* ICON */}

                <div className="son-card-icon">

                  {notification.is_read ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Bell size={20} />
                  )}

                </div>

                {/* CONTENT */}

                <div className="son-card-content">

                  <h3>
                    {notification.title ||
                      "Notification"}
                  </h3>

                  <p>
                    {notification.message ||
                      "No message available."}
                  </p>

                  <small>
                    {notification.created_at
                      ? new Date(
                          notification.created_at
                        ).toLocaleString()
                      : ""}
                  </small>

                </div>

                {/* ACTIONS */}

                <div className="son-card-actions">

                  {!notification.is_read && (

                    <button
                      type="button"
                      onClick={() =>
                        markAsRead(notification.id)
                      }
                      disabled={
                        updatingId ===
                        notification.id
                      }
                    >
                      <CheckCheck size={16} />

                      {updatingId ===
                      notification.id
                        ? "Updating..."
                        : "Mark Read"}

                    </button>

                  )}

                  {notification.order_id && (

                    <button
                      type="button"
                      className="son-order-button"
                      onClick={() =>
                        openOrder(
                          notification.order_id
                        )
                      }
                    >
                      <ShoppingBasket size={16} />
                      View Order
                    </button>

                  )}

                </div>

              </article>

            ))}

          </div>

        )}

      </div>

    </ShopOwnerLayout>
  );
}

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default ShopOwnerNotifications;
