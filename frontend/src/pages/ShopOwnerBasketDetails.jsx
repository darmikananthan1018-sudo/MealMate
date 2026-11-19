
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShoppingBasket,
  PackageCheck,
  UserRound,
  Wallet,
  ShieldCheck,
  Store,
  Clock3,
  Package,
} from "lucide-react";
import "../styles/Notifications.css";
import "../styles/ShopOwnerBasketDetails.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const STATUS_TRANSITIONS = {
  pending: ["accepted", "rejected"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export default function ShopOwnerBasketDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = () => localStorage.getItem("mealmate_token");

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Request failed."
      );
    }

    return data;
  };

  const loadOrder = async () => {
    setLoading(true);
    setError("");

    try {
      const [orderData, itemData] = await Promise.all([
        apiRequest(`/orders/${orderId}`),
        apiRequest(`/orders/${orderId}/items`),
      ]);

      setOrder(orderData.order || orderData);

      const itemList = Array.isArray(itemData)
        ? itemData
        : itemData.items || [];

      setItems(itemList);

      const initialAvailability = {};

      itemList.forEach((item) => {
        initialAvailability[item.id] =
          item.availability_status || "pending";
      });

      setSelectedAvailability(initialAvailability);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const saveItemAvailability = async (itemId) => {
    setSavingItemId(itemId);
    setError("");
    setSuccess("");

    try {
      const status = selectedAvailability[itemId];

      await apiRequest(
        `/orders/${orderId}/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            availability_status: status,
          }),
        }
      );

      setSuccess(
        "Item availability updated successfully. Customer notification will be created for low-stock or unavailable changes."
      );

      await loadOrder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  const updateOrderStatus = async () => {
  if (!selectedStatus || savingStatus) return;

  setSavingStatus(true);
  setError("");
  setSuccess("");

  try {
    await apiRequest(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: selectedStatus,
      }),
    });

    // Update successful — return to Received Orders
    navigate("/shop/orders", { replace: true });

  } catch (err) {
    setError(
      err.message || "Unable to update order status."
    );
  } finally {
    setSavingStatus(false);
  }
};

  const availableTransitions =
    STATUS_TRANSITIONS[order?.status] || [];

  const isTerminal = ["completed", "rejected", "cancelled"].includes(
    order?.status
  );

  return (
    <div className="mm-notification-page">
      <div className="mm-notification-container">
        <header className="mm-basket-hero">
          <div className="mm-basket-hero-copy">
            <button type="button" className="mm-basket-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Back to Received Orders
            </button>
            <div className="mm-basket-kicker"><ShoppingBasket size={15} /> MEALMATE PARTNER NETWORK</div>
            <h1>Basket <span>Request Details</span></h1>
            <p>Manage grocery availability, update order progress, and keep your customers informed.</p>
            <div className="mm-basket-hero-tags">
              <span><ShoppingBasket size={15} /> Manage items</span>
              <span><Clock3 size={15} /> Track progress</span>
              <span><Bell size={15} /> Notify customers</span>
            </div>
          </div>
          <div className="mm-basket-hero-art" aria-hidden="true">
            <div className="mm-basket-hero-curve" />
            <img src="/images/partner-shop-hero.png" alt="" />
            <span className="mm-basket-float mm-basket-float-one"><ShoppingBasket size={21} /></span>
            <span className="mm-basket-float mm-basket-float-two"><CheckCircle2 size={21} /></span>
            <span className="mm-basket-float mm-basket-float-three"><PackageCheck size={21} /></span>
          </div>
        </header>

        <div className="mm-basket-top-actions">
          <span>Order management / Basket request details</span>
          <button type="button" className="mm-basket-refresh" onClick={loadOrder} disabled={loading}>
            <RefreshCw size={16} className={loading ? "mm-basket-spinning" : ""} /> Refresh
          </button>
        </div>

        {error && <div className="mm-error-message">{error}</div>}

        {success && (
          <div className="mm-success-message">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {order && (
          <>
            <div className="mm-basket-summary-grid">
              <div className="mm-basket-summary-card mm-basket-summary-pink">
                <div className="mm-basket-summary-icon"><ShoppingBasket size={22} /></div>
                <span>Order Number</span><strong>#{order.id}</strong>
                <small>Grocery basket request</small>
              </div>
              <div className="mm-basket-summary-card mm-basket-summary-green">
                <div className="mm-basket-summary-icon"><UserRound size={22} /></div>
                <span>Customer</span><strong className="mm-basket-customer-name">{order.customer_name || `Customer #${order.customer_id}`}</strong>
                <small>Customer information</small>
              </div>
              <div className="mm-basket-summary-card mm-basket-summary-purple">
                <div className="mm-basket-summary-icon"><Package size={22} /></div>
                <span>Order Status</span><strong className="mm-basket-status-value">{order.status?.replaceAll("_", " ") || "Unknown"}</strong>
                <small>Current order progress</small>
              </div>
              <div className="mm-basket-summary-card mm-basket-summary-rose">
                <div className="mm-basket-summary-icon"><Wallet size={22} /></div>
                <span>Estimated Total</span><strong>Rs. {Number(order.estimated_total_lkr || 0).toLocaleString("en-LK", {maximumFractionDigits: 2})}</strong>
                <small>Estimated basket value</small>
              </div>
            </div>

            <section className="mm-notification-panel mm-basket-items-panel">
              <div className="mm-panel-header">
                <div>
                  <h2>
                    <ClipboardList size={20} />
                    Grocery Item Availability
                  </h2>
                  <p>
                    Update each item's availability before preparing
                    the order.
                  </p>
                </div>
              </div>

              <div className="mm-grocery-list">
                {items.length === 0 ? (
                  <div className="mm-empty-state">
                    No item records found for this order.
                  </div>
                ) : (
                  items.map((item) => (
                    <div className="mm-grocery-item mm-basket-item-row" key={item.id}>
                      <div className="mm-grocery-info mm-basket-item-info">
                        <div className="mm-basket-item-icon"><ShoppingBasket size={20} /></div>
                        <div>
                        <h3>{item.name || item.item_name || "Unnamed item"}</h3>
                        <p>
                          Quantity: {item.quantity} {item.unit}
                        </p>
                        <span>
                          Current: <b className={`mm-basket-item-state mm-basket-state-${item.availability_status || "pending"}`}>{(item.availability_status || "pending").replaceAll("_", " ")}</b>
                        </span>
                        </div>
                      </div>

                      <div className="mm-grocery-actions mm-basket-item-actions">
                        <select
                          value={
                            selectedAvailability[item.id] || "pending"
                          }
                          onChange={(e) =>
                            setSelectedAvailability((previous) => ({
                              ...previous,
                              [item.id]: e.target.value,
                            }))
                          }
                          disabled={isTerminal}
                        >
                          <option value="pending">Pending</option>
                          <option value="available">Available</option>
                          <option value="low_stock">Low Stock</option>
                          <option value="unavailable">Unavailable</option>
                        </select>

                        <button
                          className="mm-primary-button"
                          disabled={
                            isTerminal ||
                            savingItemId === item.id ||
                            selectedAvailability[item.id] ===
                              item.availability_status
                          }
                          onClick={() => saveItemAvailability(item.id)}
                        >
                          {savingItemId === item.id
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mm-notification-panel mm-status-panel mm-basket-status-panel">
              <div className="mm-panel-header">
                <div>
                  <h2><ShieldCheck size={20} /> Update Order Status</h2>
                  <p>
                    Changing the order status automatically notifies
                    the customer.
                  </p>
                </div>
              </div>

              {availableTransitions.length > 0 ? (
                <div className="mm-status-update-row">
                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value)
                    }
                  >
                    <option value="">Select next status</option>

                    {availableTransitions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() +
                          status.slice(1)}
                      </option>
                    ))}
                  </select>

                  <button
                    className="mm-primary-button"
                    disabled={!selectedStatus || savingStatus}
                    onClick={updateOrderStatus}
                  >
                    Update Status
                  </button>
                </div>
              ) : (
                <p className="mm-muted-text">
                  This order has reached its final status.
                </p>
              )}

              <div className="mm-auto-notification-note">
                <Bell size={18} />
                <span>
                  Notifications are sent automatically through the
                  MealMate backend when supported order or item
                  statuses change.
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
