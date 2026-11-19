import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  RefreshCw,
  ShoppingBasket,
  CheckCircle2,
  AlertCircle,
  Clock3,
  PackageCheck,
  Mail,
  CalendarDays,
} from "lucide-react";
import ShopOwnerLayout from "../components/ShopOwnerLayout";
import "../styles/ShopOwnerDashboard.css";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function ShopOwnerNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("mealmate_token") ||
      localStorage.getItem("access_token") || localStorage.getItem("token");
    if (!token) throw new Error("Session expired. Please login again.");

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.detail === "string" ? data.detail : "Unable to complete request.");
    }
    return data;
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await request("/notifications/my");
      const notificationList = Array.isArray(data)
        ? data
        : Array.isArray(data.notifications)
          ? data.notifications
          : [];
      setNotifications(notificationList);
    } catch (err) {
      setError(err.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAsRead = async (id) => {
    try {
      setUpdatingId(id);
      setError("");
      await request(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((previous) => previous.map((notification) =>
        notification.id === id ? { ...notification, is_read: true } : notification
      ));
    } catch (err) {
      setError(err.message || "Unable to update notification.");
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const openOrder = (orderId) => navigate(`/shop/orders/${orderId}/details`);

  return (
    <ShopOwnerLayout title="Notifications">
      <div className="son-page mm-notify-page">
        <section className="mm-notify-hero">
          <div className="mm-notify-hero-content">
            <span className="mm-notify-eyebrow"><ShoppingBasket size={15} /> MEALMATE PARTNER NETWORK</span>
            <h1><Bell className="mm-notify-heading-icon" size={34} /> Notifi<span>cations</span></h1>
            <p>Stay updated on your MealMate partner shop activities.</p>
            <div className="mm-notify-hero-badges">
              <span><ShoppingBasket size={16} /> New Orders</span>
              <span><Clock3 size={16} /> Order Updates</span>
              <span><Bell size={16} /> Important Alerts</span>
            </div>
          </div>
          <div className="mm-notify-hero-art" aria-hidden="true">
            <div className="mm-notify-hero-curve" />
            <img src="/images/partner-shop-hero.png" alt="" className="mm-notify-shop-image" />
            <span className="mm-notify-float mm-notify-float-one"><ShoppingBasket size={21} /></span>
            <span className="mm-notify-float mm-notify-float-two"><CheckCircle2 size={21} /></span>
            <span className="mm-notify-float mm-notify-float-three"><PackageCheck size={21} /></span>
          </div>
        </section>

        <div className="mm-notify-summary-row">
          <div className="mm-notify-statistics">
            <div className="mm-notify-stat-card mm-notify-total">
              <span className="mm-notify-stat-icon"><Bell size={26} /></span>
              <div><p>Total Notifications</p><strong>{totalCount}</strong></div>
            </div>
            <div className="mm-notify-stat-card mm-notify-unread">
              <span className="mm-notify-stat-icon"><Mail size={26} /></span>
              <div><p>Unread Notifications</p><strong>{unreadCount}</strong></div>
            </div>
          </div>
          <button type="button" className="son-refresh mm-notify-refresh" onClick={loadNotifications} disabled={loading}>
            <RefreshCw size={17} className={loading ? "mm-notify-spinning" : ""} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="son-error"><AlertCircle size={18} /><span>{error}</span></div>}

        {loading ? (
          <div className="son-empty mm-notify-empty"><RefreshCw size={28} className="mm-notify-spinning" /><h3>Loading Notifications...</h3><p>Please wait a moment.</p></div>
        ) : notifications.length === 0 ? (
          <div className="son-empty mm-notify-empty"><Bell size={30} /><h3>No Notifications Yet</h3><p>Your new shop notifications will appear here.</p></div>
        ) : (
          <div className="son-list mm-notify-list">
            {notifications.map((notification) => (
              <article key={notification.id} className={`son-card mm-notify-card ${!notification.is_read ? "son-unread" : "mm-notify-read"}`}>
                <div className="son-card-icon mm-notify-card-icon">
                  {notification.is_read ? <CheckCircle2 size={21} /> : <Bell size={21} />}
                </div>
                <div className="son-card-content mm-notify-card-content">
                  <h3>{notification.title || "Notification"}</h3>
                  <p>{notification.message || "No message available."}</p>
                  {notification.created_at && (
                    <small><CalendarDays size={14} /> {new Date(notification.created_at).toLocaleString()}</small>
                  )}
                </div>
                <div className="son-card-actions mm-notify-card-actions">
                  {!notification.is_read && (
                    <button type="button" onClick={() => markAsRead(notification.id)} disabled={updatingId === notification.id}>
                      <CheckCheck size={16} /> {updatingId === notification.id ? "Updating..." : "Mark Read"}
                    </button>
                  )}
                  {notification.order_id && (
                    <button type="button" className="son-order-button" onClick={() => openOrder(notification.order_id)}>
                      <ShoppingBasket size={16} /> View Order
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

export default ShopOwnerNotifications;
