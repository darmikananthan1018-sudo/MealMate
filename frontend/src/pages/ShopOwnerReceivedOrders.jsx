
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

function ShopOwnerReceivedOrders() {
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
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;

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

  useEffect(() => {
    if (window.location.hash === "#shop-orders" && !loading) {
      document.getElementById("shop-orders")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

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

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (safePage - 1) * ordersPerPage,
    safePage * ordersPerPage
  );

  useEffect(() => { setCurrentPage(1); }, [search, filter]);

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
          setFilter("all");
          document.getElementById("shop-orders")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <div className="so-content">

          {/* Received Orders hero — purely visual; existing order logic stays unchanged */}
          <section className="mm-received-hero" aria-labelledby="mm-received-title">
            <div className="mm-received-hero-copy">
              <span className="mm-received-eyebrow">
                <ShoppingBasket size={15} /> MEALMATE PARTNER NETWORK
              </span>
              <h1 id="mm-received-title">Received <span>Grocery Baskets</span></h1>
              <p>Review baskets sent to your shop, manage incoming orders, and keep customers updated on their basket progress.</p>
              <div className="mm-received-badges">
                <span><ShoppingBasket size={16} /> Manage baskets</span>
                <span><Clock3 size={16} /> Track orders</span>
                <span><CheckCircle2 size={16} /> Update customers</span>
              </div>
            </div>
            <div className="mm-received-hero-art" aria-hidden="true">
              <div className="mm-received-hero-curve" />
              <span className="mm-received-float mm-received-float-a"><ShoppingBasket size={22} /></span>
              <img src="/images/partner-shop-hero.png" alt="" className="mm-received-hero-image" />
              <span className="mm-received-float mm-received-float-b"><CheckCircle2 size={22} /></span>
              <span className="mm-received-float mm-received-float-c"><PackageCheck size={22} /></span>
            </div>
          </section>

          <div className="mm-received-stats" aria-label="Order statistics">
            <div className="mm-received-stat mm-received-stat-total">
              <span className="mm-received-stat-icon"><ShoppingBasket size={21} /></span>
              <span className="mm-received-stat-label">Total Orders</span>
              <strong>{stats.total}</strong>
              <small>All received baskets</small>
            </div>
            <div className="mm-received-stat mm-received-stat-pending">
              <span className="mm-received-stat-icon"><Clock3 size={21} /></span>
              <span className="mm-received-stat-label">Pending</span>
              <strong>{stats.pending}</strong>
              <small>Waiting for your response</small>
            </div>
            <div className="mm-received-stat mm-received-stat-active">
              <span className="mm-received-stat-icon"><PackageCheck size={21} /></span>
              <span className="mm-received-stat-label">In Progress</span>
              <strong>{stats.active}</strong>
              <small>Accepted, preparing or ready</small>
            </div>
            <div className="mm-received-stat mm-received-stat-completed">
              <span className="mm-received-stat-icon"><CheckCircle2 size={21} /></span>
              <span className="mm-received-stat-label">Completed</span>
              <strong>{stats.completed}</strong>
              <small>Successfully completed</small>
            </div>
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

          {/* ===================================
              RECEIVED GROCERY BASKETS
          =================================== */}

          <section
            className="so-orders-section"
            id="shop-orders"
          >
            <div className="so-section-heading">
              <div className="mm-received-list-heading">
                <h2>Customer Orders</h2>
                <p>Search, review and update the baskets received by your shop.</p>
              </div>

              <button
                type="button"
                className="so-refresh-btn"
                onClick={() => loadData()}
                disabled={refreshing}
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "so-spin" : ""}
                />
                Refresh
              </button>
            </div>

            {/* SEARCH AND FILTER */}

            <div className="so-toolbar">
              <div className="so-search">
                <Search size={18} />

                <input
                  type="search"
                  placeholder="Search order ID, customer name or phone..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />
              </div>

              <div className="so-filter">
                <select
                  value={filter}
                  onChange={(e) =>
                    setFilter(e.target.value)
                  }
                >
                  <option value="all">
                    All Orders
                  </option>

                  {Object.entries(STATUS_LABELS).map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown size={17} />
              </div>
            </div>

            {/* ORDER LIST */}

            <div className="so-orders-list">
              {filteredOrders.length === 0 ? (
                <div className="so-empty">
                  <ShoppingBasket size={40} />
                  <h3>No orders found</h3>

                  <p>
                    {orders.length === 0
                      ? "Customer grocery baskets sent to your shop will appear here."
                      : "Try another search or status filter."}
                  </p>
                </div>
              ) : (
                paginatedOrders.map((order) => (
                  <article
                    className="so-order-card"
                    key={order.id}
                  >
                    <div className="so-order-top">
                      <div>
                        <strong>
                          Order #{order.id}
                        </strong>

                        <p>
                          {order.customer_name ||
                            `Customer #${order.customer_id}`}
                          {" • "}
                          {order.created_at
                            ? new Date(
                                order.created_at
                              ).toLocaleString()
                            : "Date unavailable"}
                        </p>
                      </div>

                      <span
                        className={`so-status so-status-${order.status}`}
                      >
                        {STATUS_LABELS[order.status] ||
                          order.status}
                      </span>
                    </div>

                    {/* CUSTOMER DETAILS */}

                    <div className="so-customer-info">
                      <div className="so-customer-info-title">
                        <UserRound size={17} />
                        <strong>
                          Customer Details
                        </strong>
                      </div>

                      <div className="so-customer-info-grid">
                        <div className="so-customer-info-row">
                          <UserRound size={17} />
                          <span>
                            {order.customer_name ||
                              "Name not provided"}
                          </span>
                        </div>

                        <div className="so-customer-info-row">
                          <Phone size={17} />
                          <span>
                            {order.customer_phone ||
                              "Phone not provided"}
                          </span>
                        </div>

                        <div className="so-customer-info-row">
                          <MapPin size={17} />
                          <span>
                            {order.customer_address ||
                              "Address not provided"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ORDER SUMMARY */}

                    <div className="so-order-details">
                      <div>
                        <small>Grocery Basket</small>
                        <strong>
                          #{order.grocery_basket_id}
                        </strong>
                      </div>

                      <div>
                        <small>Items</small>
                        <strong>
                          {getItems(order).length}
                        </strong>
                      </div>

                      <div>
                        <small>Estimated Total</small>
                        <strong>
                          {money(
                            order.estimated_total_lkr
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* ORDER ACTION BUTTONS */}

                    <div className="so-order-bottom">

                      {/* EXISTING BASKET POPUP */}

                      <button
                        type="button"
                        className="so-btn so-btn-outline"
                        onClick={() =>
                          setSelectedOrder(order)
                        }
                      >
                        View Basket Details
                      </button>

                      {/* NEW NOTIFICATION PAGE */}

                      <button
                        type="button"
                        className="so-btn so-btn-primary"
                        onClick={() =>
                          openBasketNotificationPage(
                            order.id
                          )
                        }
                      >
                        <Bell size={17} />
                        Manage Items & Notify Customer
                      </button>

                      {/* EXISTING STATUS BUTTONS */}

                      {renderActions(order)}
                    </div>
                  </article>
                ))
              )}
            </div>
            {filteredOrders.length > 0 && (
              <nav className="so-pagination" aria-label="Received orders pages">
                <span>Showing {(safePage - 1) * ordersPerPage + 1}–{Math.min(safePage * ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders</span>
                <div className="so-pagination-buttons">
                  <button type="button" disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button type="button" key={page} className={page === safePage ? "active" : ""} aria-current={page === safePage ? "page" : undefined} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                  <button type="button" disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>Next</button>
                </div>
              </nav>
            )}
          </section>

          {/* FOOTER */}

          <footer className="so-footer">
            © MealMate Partner Portal · Plan Smart.
            Eat Healthy.
          </footer>
        </div>
      </ShopOwnerLayout>

      {/* ===================================
          BASKET DETAILS MODAL
      =================================== */}

      {selectedOrder && (
        <div
          className="so-modal-backdrop"
          onClick={() => setSelectedOrder(null)}
        >
          <section
            className="so-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="so-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="so-modal-header">
              <div>
                <span className="so-eyebrow">
                  CUSTOMER GROCERY BASKET
                </span>

                <h2 id="so-modal-title">
                  Order #{selectedOrder.id}
                </h2>
              </div>

              <button
                type="button"
                className="so-close"
                onClick={() =>
                  setSelectedOrder(null)
                }
                aria-label="Close order details"
              >
                <X size={22} />
              </button>
            </div>

            <div className="so-modal-body">
              <div className="so-modal-meta">
                <div>
                  <UserRound size={17} />
                  Customer #{selectedOrder.customer_id}
                </div>

                <div>
                  <ShoppingBasket size={17} />
                  Basket #{selectedOrder.grocery_basket_id}
                </div>
              </div>

              {/* CUSTOMER CONTACT */}

              <div className="so-customer-info so-customer-info-modal">
                <div className="so-customer-info-title">
                  <UserRound size={17} />
                  <strong>
                    Customer Contact Details
                  </strong>
                </div>

                <div className="so-customer-info-grid">
                  <div className="so-customer-info-row">
                    <UserRound size={17} />
                    <span>
                      {selectedOrder.customer_name ||
                        "Name not provided"}
                    </span>
                  </div>

                  <div className="so-customer-info-row">
                    <Phone size={17} />
                    <span>
                      {selectedOrder.customer_phone ||
                        "Phone not provided"}
                    </span>
                  </div>

                  <div className="so-customer-info-row">
                    <MapPin size={17} />
                    <span>
                      {selectedOrder.customer_address ||
                        "Address not provided"}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`so-status so-status-${selectedOrder.status}`}
              >
                {STATUS_LABELS[selectedOrder.status] ||
                  selectedOrder.status}
              </span>

              <h3>Grocery Items</h3>

              {getItems(selectedOrder).length === 0 ? (
                <p className="so-muted">
                  No item details available in this
                  basket snapshot.
                </p>
              ) : (
                <div className="so-items">
                  {getItems(selectedOrder).map(
                    (item, index) => (
                      <div
                        className="so-item"
                        key={index}
                      >
                        <div>
                          <strong>
                            {itemName(item)}
                          </strong>

                          <small>
                            {itemQuantity(item)}
                          </small>
                        </div>

                        <span>
                          {itemPrice(item) == null
                            ? "—"
                            : money(itemPrice(item))}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="so-total">
                <span>
                  Estimated Basket Total
                </span>

                <strong>
                  {money(
                    selectedOrder.estimated_total_lkr
                  )}
                </strong>
              </div>
            </div>

            {/* MODAL FOOTER */}

            <div className="so-modal-footer">

              {/* NEW NOTIFICATION PAGE BUTTON */}

              <button
                type="button"
                className="so-btn so-btn-primary"
                onClick={() =>
                  openBasketNotificationPage(
                    selectedOrder.id
                  )
                }
              >
                <Bell size={17} />
                Manage Items & Notify Customer
              </button>

              {/* EXISTING STATUS ACTIONS */}

              {renderActions(selectedOrder)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default ShopOwnerReceivedOrders;
