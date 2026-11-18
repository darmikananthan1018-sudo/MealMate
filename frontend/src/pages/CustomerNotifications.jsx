
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bell,
  CheckCheck,
  ArrowLeft,
  PackageCheck,
  AlertCircle,
  Clock3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShoppingBasket,
} from "lucide-react";

import "../styles/Notifications.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

// ========================================
// ITEM HELPERS
// ========================================

const getItemName = (item) =>
  item.item_name ||
  item.name ||
  item.food_name ||
  item.ingredient ||
  "Grocery Item";

const getItemQuantity = (item) => {
  const quantity = item.quantity ?? item.qty;
  const unit = item.unit || "";

  if (quantity == null) return "Not specified";

  return `${quantity} ${unit}`.trim();
};

const getAvailability = (item) =>
  String(
    item.availability_status ||
    item.status ||
    ""
  ).toLowerCase();

const getOrderItems = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.items)) return data.items;

  if (Array.isArray(data?.order_items))
    return data.order_items;

  if (Array.isArray(data?.data?.items))
    return data.data.items;

  return [];
};

const isItemAlert = (notification) => {
  const content = `${notification.title || ""} ${
    notification.message || ""
  }`.toLowerCase();

  return (
    content.includes("unavailable") ||
    content.includes("low stock") ||
    content.includes("low_stock")
  );
};

// ========================================
// CUSTOMER NOTIFICATIONS
// ========================================

export default function CustomerNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  // NEW: EXPANDED NOTIFICATION
  const [expandedId, setExpandedId] = useState(null);

  // NEW: ORDER ITEMS CACHE
  const [orderItems, setOrderItems] = useState({});

  // NEW: ITEM LOADING AND ERRORS
  const [itemsLoading, setItemsLoading] = useState({});
  const [itemsErrors, setItemsErrors] = useState({});

  // ========================================
  // FETCH NOTIFICATIONS
  // ========================================

  const fetchNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/notifications/my`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load notifications.");
      }

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : data.notifications || [];

      setNotifications(list);

      setUnreadCount(
        typeof data.unread_count === "number"
          ? data.unread_count
          : list.filter((item) => !item.is_read).length
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // ========================================
  // MARK AS READ
  // ========================================

  const markAsRead = async (id) => {
    const notification = notifications.find(
      (item) => item.id === id
    );

    if (!notification || notification.is_read) return;

    setUpdatingId(id);

    try {
      const response = await fetch(
        `${API_URL}/notifications/${id}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to mark notification as read."
        );
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, is_read: true }
            : item
        )
      );

      setUnreadCount((previous) =>
        Math.max(0, previous - 1)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // ========================================
  // FETCH ORDER ITEM AVAILABILITY
  // ========================================

  const fetchOrderItems = async (orderId) => {
    if (orderItems[orderId]) return;

    setItemsLoading((previous) => ({
      ...previous,
      [orderId]: true,
    }));

    setItemsErrors((previous) => ({
      ...previous,
      [orderId]: "",
    }));

    try {
      const response = await fetch(
        `${API_URL}/orders/${orderId}/items`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "You do not have permission to view these order items."
            : "Unable to load grocery item details."
        );
      }

      const data = await response.json();

      setOrderItems((previous) => ({
        ...previous,
        [orderId]: getOrderItems(data),
      }));
    } catch (err) {
      setItemsErrors((previous) => ({
        ...previous,
        [orderId]: err.message,
      }));
    } finally {
      setItemsLoading((previous) => ({
        ...previous,
        [orderId]: false,
      }));
    }
  };

  // ========================================
  // NOTIFICATION CLICK
  // ========================================

  const handleNotificationClick = async (notification) => {
    if (expandedId === notification.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(notification.id);

    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (
      isItemAlert(notification) &&
      notification.order_id
    ) {
      fetchOrderItems(notification.order_id);
    }
  };

  // ========================================
  // ICONS
  // ========================================

  const getNotificationIcon = (notification) => {
    const message = `${
      notification.title || ""
    } ${notification.message || ""}`.toLowerCase();

    if (isItemAlert(notification)) {
      return <AlertCircle size={22} />;
    }

    if (
      message.includes("completed") ||
      message.includes("ready")
    ) {
      return <PackageCheck size={22} />;
    }

    return <Bell size={22} />;
  };

  // ========================================
  // FILTER NOTIFICATIONS
  // ========================================

  const filteredNotifications = notifications.filter(
    (notification) =>
      activeTab === "unread"
        ? !notification.is_read
        : true
  );

  // ========================================
  // UI
  // ========================================

  return (
    <div className="mm-notification-page">
      <div className="mm-notification-container">

        
{/* NOTIFICATIONS HERO */}
<header className="mm-notification-header">
  <div className="mm-notification-hero-content">
    <div className="mm-notification-hero-badge">
      <Bell size={14} />
      MEALMATE NOTIFICATIONS
    </div>

    <h1 className="mm-notification-hero-title">
      <Bell size={29} />
      My <span>Notifications</span>
    </h1>

    <p className="mm-notification-hero-description">
      Stay updated on your grocery orders, basket requests,
      and important updates from your trusted partner shops.
    </p>

    <div className="mm-notification-hero-highlights">
      <span>
        <CheckCheck size={15} />
        Order Updates
      </span>
      <span>
        <CheckCheck size={15} />
        Basket Requests
      </span>
      <span>
        <CheckCheck size={15} />
        Instant Alerts
      </span>
    </div>
  </div>

  <div className="mm-notification-hero-visual">
    <div className="mm-notification-hero-circle" />

    <img
  className="mm-notification-hero-image"
  src="/images/notifications-hero.png"
  alt="MealMate Notifications"
/>
  </div>

  <button
    type="button"
    className="mm-refresh-button mm-hero-refresh"
    onClick={fetchNotifications}
    disabled={loading}
  >
    <RefreshCw size={16} />
    Refresh
  </button>
</header>


        {/* SUMMARY */}

        <div className="mm-notification-summary">
          <div className="mm-summary-card">
            <span>Total Notifications</span>
            <strong>{notifications.length}</strong>
          </div>

          <div className="mm-summary-card">
            <span>Unread Notifications</span>
            <strong>{unreadCount}</strong>
          </div>
        </div>

        {/* NOTIFICATION PANEL */}

        <div className="mm-notification-panel">
          <div className="mm-panel-header">
            <h2>Recent Notifications</h2>

            <div className="mm-notification-tabs">
              <button
                type="button"
                className={
                  activeTab === "all" ? "active" : ""
                }
                onClick={() => setActiveTab("all")}
              >
                All
              </button>

              <button
                type="button"
                className={
                  activeTab === "unread" ? "active" : ""
                }
                onClick={() => setActiveTab("unread")}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {error && (
            <div className="mm-error-message">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mm-empty-state">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="mm-empty-state">
              <Bell size={36} />
              <h3>No notifications</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className="mm-notification-list">
              {filteredNotifications.map((notification) => {
                const expanded =
                  expandedId === notification.id;

                const itemAlert =
                  isItemAlert(notification);

                const orderId =
                  notification.order_id;

                const items =
                  orderItems[orderId] || [];

                const unavailableItems =
                  items.filter((item) =>
                    ["unavailable", "low_stock"].includes(
                      getAvailability(item)
                    )
                  );

                return (
                  <div
                    key={notification.id}
                    className={`mm-notification-item ${
                      !notification.is_read
                        ? "mm-unread"
                        : ""
                    }`}
                    style={{
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="mm-item-icon">
                      {getNotificationIcon(notification)}
                    </div>

                    <div
                      className="mm-item-content"
                      style={{ minWidth: 0 }}
                    >
                      {/* CLICKABLE NOTIFICATION */}

                      <button
                        type="button"
                        onClick={() =>
                          handleNotificationClick(
                            notification
                          )
                        }
                        aria-expanded={expanded}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: "inherit",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div className="mm-item-title-row">
                          <h3>{notification.title}</h3>

                          {!notification.is_read && (
                            <span className="mm-unread-dot" />
                          )}

                          {expanded ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </div>

                        <p>{notification.message}</p>
                      </button>

                      <div className="mm-item-meta">
                        <span>
                          <Clock3 size={14} />

                          {notification.created_at
                            ? new Date(
                                notification.created_at
                              ).toLocaleString()
                            : "Date unavailable"}
                        </span>

                        {orderId && (
                          <span>Order #{orderId}</span>
                        )}
                      </div>

                      {/* EXPANDED NOTIFICATION DETAILS */}

                      {expanded && (
                        <div className="mm-expanded-details">

                          {itemAlert ? (
                            <>
                              <h4>
                                <ShoppingBasket size={17} />
                                Grocery Item Availability
                              </h4>

                              {!orderId ? (
                                <p>
                                  This notification has no
                                  linked order ID.
                                </p>
                              ) : itemsLoading[orderId] ? (
                                <p>
                                  Loading unavailable items...
                                </p>
                              ) : itemsErrors[orderId] ? (
                                <div>
                                  <p>
                                    {itemsErrors[orderId]}
                                  </p>

                                  <button
                                    type="button"
                                    className="mm-refresh-button"
                                    onClick={() =>
                                      fetchOrderItems(orderId)
                                    }
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : unavailableItems.length === 0 ? (
                                <p>
                                  No unavailable or low-stock
                                  items are currently reported
                                  for this order.
                                </p>
                              ) : (
                                <div className="mm-unavailable-list">
                                  {unavailableItems.map(
                                    (item, index) => {
                                      const status =
                                        getAvailability(item);

                                      return (
                                        <div
                                          className="mm-unavailable-item"
                                          key={
                                            item.id ??
                                            index
                                          }
                                        >
                                          <div>
                                            <strong>
                                              {getItemName(item)}
                                            </strong>

                                            <small>
                                              Quantity:{" "}
                                              {getItemQuantity(
                                                item
                                              )}
                                            </small>
                                          </div>

                                          <span
                                            className={`mm-availability-badge ${
                                              status ===
                                              "unavailable"
                                                ? "mm-availability-unavailable"
                                                : "mm-availability-low"
                                            }`}
                                          >
                                            {status ===
                                            "unavailable"
                                              ? "Unavailable"
                                              : "Low Stock"}
                                          </span>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <h4>
                                Order Notification
                              </h4>

                              <p>
                                {notification.message}
                              </p>

                              {orderId && (
                                <p>
                                  Order #{orderId}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MARK AS READ */}

                    {!notification.is_read && (
                      <button
                        type="button"
                        className="mm-mark-read-button"
                        onClick={() =>
                          markAsRead(notification.id)
                        }
                        disabled={
                          updatingId === notification.id
                        }
                      >
                        <CheckCheck size={16} />
                        Mark as read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
