
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShoppingBasket,
} from "lucide-react";
import "../styles/Notifications.css";

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
    if (!selectedStatus) return;

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

      setSelectedStatus("");
      setSuccess(
        "Order status updated. Customer notification created."
      );

      await loadOrder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="mm-notification-page">
        <div className="mm-empty-state">Loading order details...</div>
      </div>
    );
  }

  const availableTransitions =
    STATUS_TRANSITIONS[order?.status] || [];

  const isTerminal = ["completed", "rejected", "cancelled"].includes(
    order?.status
  );

  return (
    <div className="mm-notification-page">
      <div className="mm-notification-container">
        <header className="mm-notification-header">
          <div>
            <button
              className="mm-back-button"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={17} />
              Back
            </button>

            <div className="mm-page-heading">
              <div className="mm-heading-icon">
                <ShoppingBasket size={25} />
              </div>

              <div>
                <h1>Basket Request Details</h1>
                <p>
                  Manage grocery availability and notify the customer.
                </p>
              </div>
            </div>
          </div>

          <button
            className="mm-refresh-button"
            onClick={loadOrder}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </header>

        {error && <div className="mm-error-message">{error}</div>}

        {success && (
          <div className="mm-success-message">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {order && (
          <>
            <div className="mm-order-info-grid">
              <div className="mm-summary-card">
                <span>Order Number</span>
                <strong>#{order.id}</strong>
              </div>

              <div className="mm-summary-card">
                <span>Customer</span>
                <strong>
                  {order.customer_name || `Customer #${order.customer_id}`}
                </strong>
              </div>

              <div className="mm-summary-card">
                <span>Order Status</span>
                <strong className="mm-status-text">
                  {order.status}
                </strong>
              </div>

              <div className="mm-summary-card">
                <span>Estimated Total</span>
                <strong>
                  Rs. {Number(order.estimated_total_lkr || 0).toLocaleString()}
                </strong>
              </div>
            </div>

            <section className="mm-notification-panel">
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
                    <div className="mm-grocery-item" key={item.id}>
                      <div className="mm-grocery-info">
                        <h3>{item.name || item.item_name || "Unnamed item"}</h3>
                        <p>
                          Quantity: {item.quantity} {item.unit}
                        </p>
                        <span>
                          Current: {item.availability_status}
                        </span>
                      </div>

                      <div className="mm-grocery-actions">
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

            <section className="mm-notification-panel mm-status-panel">
              <div className="mm-panel-header">
                <div>
                  <h2>Update Order Status</h2>
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
