
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserRound,
  Store,
  Clock3,
  ShoppingBasket,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import "../styles/AdminDashboard.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

async function adminGet(path, signal) {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in to access the Admin Dashboard.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (response.status === 401) {
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 403) {
    throw new Error("Admin access required.");
  }

  if (!response.ok) {
    throw new Error(
      `Could not load ${path} (${response.status}).`
    );
  }

  return response.json();
}

const formatMoney = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-LK") : "—";

export default function AdminDashboard() {
  const [data, setData] = useState({
    stats: null,
    orders: null,
    recent: [],
    pending: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  const reload = useCallback(() => {
    setRefreshIndex((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        // Verify logged-in user's role
        const profile = await adminGet(
          "/auth/me",
          controller.signal
        );

        if (profile.role !== "admin") {
          throw new Error("Admin access required.");
        }

        // Load dashboard information
        const results = await Promise.allSettled([
          adminGet(
            "/admin/dashboard/stats",
            controller.signal
          ),
          adminGet(
            "/admin/dashboard/orders",
            controller.signal
          ),
          adminGet(
            "/admin/dashboard/recent-orders",
            controller.signal
          ),
          adminGet(
            "/admin/shop-owners/pending",
            controller.signal
          ),
        ]);

        if (controller.signal.aborted) return;

        const [stats, orders, recent, pending] =
          results.map((result) =>
            result.status === "fulfilled"
              ? result.value
              : null
          );

        setData({
          stats,
          orders,
          recent: Array.isArray(recent) ? recent : [],
          pending: Array.isArray(pending) ? pending : [],
        });

        const failures = results.filter(
          (result) => result.status === "rejected"
        );

        if (failures.length > 0) {
          setError(
            `${failures.length} dashboard section(s) could not load. Check your Admin APIs.`
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [refreshIndex]);

  const cards = [
    {
      label: "Total Users",
      value: data.stats?.total_users,
      icon: Users,
    },
    {
      label: "Customers",
      value: data.stats?.total_customers,
      icon: UserRound,
    },
    {
      label: "Shop Owners",
      value: data.stats?.total_shop_owners,
      icon: Store,
    },
    {
      label: "Pending Approvals",
      value: data.stats?.pending_shop_owners,
      icon: Clock3,
    },
    {
      label: "Total Orders",
      value: data.orders?.total_orders,
      icon: ShoppingBasket,
    },
    {
      label: "Approved Shops",
      value: data.stats?.approved_shop_owners,
      icon: CheckCircle2,
    },
  ];

  const statusEntries = Object.entries(
    data.orders?.orders_by_status || {}
  );

  return (
    <main className="admin-dashboard">
      {/* DASHBOARD HEADER */}
      <header className="admin-hero">
        <div>
          <span className="admin-eyebrow">
            <ShieldCheck size={15} />
            MEALMATE ADMIN
          </span>

          <h1>
            Admin Dashboard <span>✦</span>
          </h1>

          <p>
            Monitor your customers, partner shops and
            grocery basket orders in one place.
          </p>

          <button
            className="admin-refresh"
            type="button"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "admin-spin" : ""}
            />
            Refresh Data
          </button>
        </div>

        <div className="admin-hero-art" aria-hidden="true">
          <ShoppingBasket size={92} strokeWidth={1.3} />
        </div>
      </header>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      {/* STATISTICS CARDS */}
      <section className="admin-stats">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="admin-stat-card" key={label}>
            <div className="admin-stat-icon">
              <Icon size={21} />
            </div>

            <span>{label}</span>

            <strong>
              {value ?? (loading ? "…" : "—")}
            </strong>
          </div>
        ))}
      </section>

      {/* ORDER AND SHOP OVERVIEW */}
      <div className="admin-columns">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Order Overview</h2>
            <ShoppingBasket size={19} />
          </div>

          <div className="admin-order-value">
            <span>Total Estimated Order Value</span>

            <strong>
              {data.orders
                ? formatMoney(
                    data.orders.total_estimated_order_value_lkr
                  )
                : "—"}
            </strong>
          </div>

          <p className="admin-note">
            Estimated basket totals, not confirmed revenue.
          </p>

          <h3>Orders by Status</h3>

          {statusEntries.length ? (
            statusEntries.map(([orderStatus, count]) => (
              <div
                className="admin-status-row"
                key={orderStatus}
              >
                <span className="admin-status-name">
                  {orderStatus.replaceAll("_", " ")}
                </span>

                <strong>{count}</strong>
              </div>
            ))
          ) : (
            <p className="admin-muted">
              {loading
                ? "Loading order statistics…"
                : "No order status data available."}
            </p>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Shop Owner Approvals</h2>
            <Store size={19} />
          </div>

          <div className="admin-approval-metrics">
            <div>
              <CheckCircle2 size={18} />
              <strong>
                {data.stats?.approved_shop_owners ?? "—"}
              </strong>
              <span>Approved</span>
            </div>

            <div>
              <Clock3 size={18} />
              <strong>
                {data.stats?.pending_shop_owners ?? "—"}
              </strong>
              <span>Pending</span>
            </div>

            <div>
              <XCircle size={18} />
              <strong>
                {data.stats?.rejected_shop_owners ?? "—"}
              </strong>
              <span>Rejected</span>
            </div>
          </div>

          <h3>Awaiting Review</h3>

          {data.pending.length ? (
            data.pending.slice(0, 4).map((shop) => (
              <div
                className="admin-pending-row"
                key={shop.id}
              >
                <div>
                  <strong>
                    {shop.shop_name || shop.full_name}
                  </strong>

                  <small>{shop.email}</small>
                </div>

                <span>Pending</span>
              </div>
            ))
          ) : (
            <p className="admin-muted">
              {loading
                ? "Loading approvals…"
                : "No pending shop owners."}
            </p>
          )}

          <p className="admin-note">
            Approval actions are available through the
            protected Admin API.
          </p>
        </section>
      </div>

      {/* RECENT ORDERS TABLE */}
      <section className="admin-panel admin-recent-panel">
        <div className="admin-panel-heading">
          <h2>Recent Orders</h2>
          <span className="admin-small-label">
            Latest 10
          </span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer ID</th>
                <th>Shop ID</th>
                <th>Status</th>
                <th>Estimated Total</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {data.recent.length ? (
                data.recent.map((order) => (
                  <tr key={order.order_id}>
                    <td>
                      <strong>
                        #{order.order_id}
                      </strong>
                    </td>

                    <td>{order.customer_id}</td>
                    <td>{order.shop_id}</td>

                    <td>
                      <span className="admin-order-status">
                        {order.status}
                      </span>
                    </td>

                    <td>
                      {formatMoney(
                        order.estimated_total_lkr
                      )}
                    </td>

                    <td>
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="admin-empty"
                  >
                    {loading
                      ? "Loading recent orders…"
                      : "No recent orders available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
