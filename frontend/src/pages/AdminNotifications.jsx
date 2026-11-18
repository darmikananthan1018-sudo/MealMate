
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  RefreshCw,
  Search,
  Inbox,
  Clock3,
  ShoppingBasket,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";

import "../styles/AdminDashboard.css";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

async function request(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in as an administrator.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return data;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  // Backend returns a naive datetime in ISO format.
  // Display without assuming an unknown timezone.
  const [datePart, timePart = ""] = value.split("T");

  const date = datePart?.split("-");

  if (!date || date.length !== 3) return value;

  const [year, month, day] = date;

  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`;
}

function NotificationCard({
  notification,
  busy,
  onRead,
  onOpenOrder,
}) {
  const isOrder = notification.order_id != null;

  return (
    <article
      className={`an-notification-card ${
        notification.is_read ? "read" : "unread"
      }`}
    >
      <div className="an-card-icon">
        {isOrder ? (
          <ShoppingBasket size={22} />
        ) : (
          <Bell size={22} />
        )}
      </div>

      <div className="an-card-content">
        <div className="an-card-top">
          <div>
            <h3>{notification.title}</h3>

            <span className="an-date">
              <Clock3 size={13} />
              {formatDate(notification.created_at)}
            </span>
          </div>

          <span
            className={`an-status ${
              notification.is_read ? "read" : "unread"
            }`}
          >
            {notification.is_read ? "Read" : "Unread"}
          </span>
        </div>

        <p className="an-message">{notification.message}</p>

        <div className="an-card-bottom">
          {isOrder && (
            <button
              type="button"
              className="an-order-link"
              onClick={() => onOpenOrder(notification.order_id)}
            >
              View Order #{notification.order_id}
              <ArrowRight size={14} />
            </button>
          )}

          {!notification.is_read && (
            <button
              type="button"
              className="an-read-btn"
              disabled={busy}
              onClick={() => onRead(notification.id)}
            >
              {busy ? (
                <RefreshCw size={14} className="an-spin" />
              ) : (
                <Check size={15} />
              )}
              {busy ? "Updating..." : "Mark as Read"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyIds, setBusyIds] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (signal) => {
    const data = await request("/notifications/my", { signal });

    if (!signal?.aborted) {
      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function initialLoad() {
      setLoading(true);
      setError("");

      try {
        await loadNotifications(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Could not load notifications.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => controller.abort();
  }, [loadNotifications]);

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notifications.filter((item) => {
      if (filter === "unread" && item.is_read) return false;
      if (filter === "read" && !item.is_read) return false;

      if (!term) return true;

      return [
        item.title,
        item.message,
        item.order_id != null
          ? String(item.order_id)
          : "",
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      );
    });
  }, [notifications, filter, search]);

  const refreshNotifications = async () => {
    if (refreshing || markingAll || busyIds.length) return;

    setRefreshing(true);
    setError("");
    setSuccess("");

    try {
      await loadNotifications();
    } catch (err) {
      setError(err.message || "Could not refresh notifications.");
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId) => {
    if (markingAll || busyIds.includes(notificationId)) return;

    setBusyIds((prev) => [...prev, notificationId]);
    setError("");
    setSuccess("");

    try {
      await request(`/notifications/${notificationId}/read`, {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true }
            : item
        )
      );

      setSuccess("Notification marked as read.");
    } catch (err) {
      setError(err.message || "Could not update notification.");
    } finally {
      setBusyIds((prev) =>
        prev.filter((id) => id !== notificationId)
      );
    }
  };

  const markAllAsRead = async () => {
    if (markingAll || busyIds.length || refreshing) return;

    const unreadIds = notifications
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (!unreadIds.length) return;

    setMarkingAll(true);
    setError("");
    setSuccess("");

    const completedIds = [];
    const failedIds = [];

    // Existing backend has only a single-notification
    // read endpoint, so update each unread item.
    for (const id of unreadIds) {
      try {
        await request(`/notifications/${id}/read`, {
          method: "PATCH",
        });
        completedIds.push(id);
      } catch {
        failedIds.push(id);
      }
    }

    const completedSet = new Set(completedIds);

    setNotifications((prev) =>
      prev.map((item) =>
        completedSet.has(item.id)
          ? { ...item, is_read: true }
          : item
      )
    );

    if (failedIds.length) {
      setError(
        `${failedIds.length} notification(s) could not be marked as read. Please retry.`
      );
    } else {
      setSuccess("All notifications marked as read.");
    }

    setMarkingAll(false);
  };

  const openOrder = (orderId) => {
    // Existing Admin Orders route.
    // No new route or order detail path is assumed.
    window.location.assign("/admin/orders");
  };

  return (
    <main className="an-page">
      <header className="an-hero">
        <div className="an-hero-content">
          <span className="an-eyebrow">
            <BellRing size={15} />
            MEALMATE ADMIN CENTER
          </span>

          <h1>
            Notifications <span>✦</span>
          </h1>

          <p>
            Stay updated with new grocery basket orders
            and important platform activities.
          </p>

          <span className="an-hero-count">
            <span className="an-count-dot" />
            {unreadCount} unread notifications
          </span>
        </div>

        <div className="an-hero-actions">
          <div className="an-hero-icon">
            <BellRing size={50} strokeWidth={1.5} />
          </div>

          <button
            type="button"
            className="an-refresh-btn"
            onClick={refreshNotifications}
            disabled={loading || refreshing || markingAll || busyIds.length > 0}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "an-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="an-stats-grid">
        <div className="an-stat-card">
          <span className="an-stat-icon purple">
            <Bell size={23} />
          </span>
          <div>
            <p>Total Notifications</p>
            <strong>{notifications.length}</strong>
          </div>
        </div>

        <div className="an-stat-card lime">
          <span className="an-stat-icon green">
            <BellRing size={23} />
          </span>
          <div>
            <p>Unread Notifications</p>
            <strong>{unreadCount}</strong>
          </div>
        </div>

        <div className="an-stat-card">
          <span className="an-stat-icon purple">
            <CheckCheck size={23} />
          </span>
          <div>
            <p>Read Notifications</p>
            <strong>{readCount}</strong>
          </div>
        </div>
      </section>

      <section className="an-main-panel">
        <div className="an-panel-heading">
          <div>
            <span className="an-section-eyebrow">
              NOTIFICATION INBOX
            </span>
            <h2>All Notifications</h2>
            <p>
              View and manage your admin notifications.
            </p>
          </div>

          <button
            type="button"
            className="an-mark-all-btn"
            disabled={
              unreadCount === 0 ||
              markingAll ||
              refreshing ||
              loading ||
              busyIds.length > 0
            }
            onClick={markAllAsRead}
          >
            {markingAll ? (
              <RefreshCw size={16} className="an-spin" />
            ) : (
              <CheckCheck size={17} />
            )}
            {markingAll ? "Updating..." : "Mark All as Read"}
          </button>
        </div>

        <div className="an-toolbar">
          <div className="an-tabs">
            {[
              { key: "all", label: "All", count: notifications.length },
              { key: "unread", label: "Unread", count: unreadCount },
              { key: "read", label: "Read", count: readCount },
            ].map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={`an-tab ${
                  filter === tab.key ? "active" : ""
                }`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="an-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search notifications..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="an-alert error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="an-alert success" role="status">
            <Check size={17} />
            <span>{success}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setSuccess("")}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="an-empty">
            <RefreshCw size={30} className="an-spin" />
            <h3>Loading notifications...</h3>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="an-empty">
            <span className="an-empty-icon">
              <Inbox size={38} />
            </span>
            <h3>No notifications found</h3>
            <p>
              {search
                ? "Try searching with another keyword."
                : filter === "unread"
                ? "You have no unread notifications."
                : "There are no notifications to display."}
            </p>
          </div>
        ) : (
          <div className="an-notifications-list">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                busy={
                  markingAll ||
                  busyIds.includes(notification.id)
                }
                onRead={markAsRead}
                onOpenOrder={openOrder}
              />
            ))}
          </div>
        )}

        {!loading && (
          <div className="an-list-footer">
            Showing {filteredNotifications.length} of{" "}
            {notifications.length} notifications
          </div>
        )}
      </section>
    </main>
  );
}
