
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Users,
  Store,
  ShoppingBasket,
  Wallet,
  RefreshCw,
  CheckCircle2,
  Clock3,
  XCircle,
  UserCheck,
  UserX,
  TrendingUp,
  AlertCircle,
  Activity,
} from "lucide-react";

import "../styles/AdminDashboard.css";


const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

async function apiRequest(path, signal) {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in as an administrator.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
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

const ORDER_STATUSES = [
  { key: "pending", label: "Pending", color: "#f5bc59" },
  { key: "accepted", label: "Accepted", color: "#9a69cc" },
  { key: "preparing", label: "Preparing", color: "#7c5ac8" },
  { key: "ready", label: "Ready", color: "#88b935" },
  { key: "completed", label: "Completed", color: "#76ae2b" },
  { key: "rejected", label: "Rejected", color: "#df768b" },
  { key: "cancelled", label: "Cancelled", color: "#9a8e9c" },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-LK");
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPercentage(value, total) {
  if (!total) return 0;
  return Math.round((Number(value) / Number(total)) * 100);
}

function ReportCard({ icon: Icon, label, value, description, variant = "" }) {
  return (
    <article className={`ar-summary-card ${variant}`}>
      <div className="ar-summary-top">
        <span className="ar-summary-icon">
          <Icon size={23} />
        </span>
        <TrendingUp size={17} className="ar-summary-decoration" />
      </div>

      <p>{label}</p>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

function DistributionRow({ label, value, total, color }) {
  const percentage = getPercentage(value, total);

  return (
    <div className="ar-distribution-row">
      <div className="ar-distribution-labels">
        <span>
          <i
            className="ar-distribution-dot"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>

        <strong>
          {formatNumber(value)}
          <small>{percentage}%</small>
        </strong>
      </div>

      <div
        className="ar-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Number(value)}
        aria-valuemin={0}
        aria-valuemax={Number(total) || 0}
      >
        <div
          className="ar-progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [userStats, setUserStats] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadReports = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const [users, orders] = await Promise.all([
        apiRequest("/admin/dashboard/stats", signal),
        apiRequest("/admin/dashboard/orders", signal),
      ]);

      if (!signal.aborted) {
        setUserStats(users);
        setOrderStats(orders);
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err.message || "Unable to load reports.");
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadReports(controller.signal);

    return () => controller.abort();
  }, [loadReports, refreshKey]);

  const users = userStats || {};
  const orders = orderStats || {};

  const totalCustomers = Number(users.total_customers || 0);
  const activeCustomers = Number(users.active_customers || 0);
  const inactiveCustomers = Number(users.inactive_customers || 0);

  const totalShops = Number(users.total_shop_owners || 0);
  const pendingShops = Number(users.pending_shop_owners || 0);
  const approvedShops = Number(users.approved_shop_owners || 0);
  const rejectedShops = Number(users.rejected_shop_owners || 0);

  const totalOrders = Number(orders.total_orders || 0);
  const estimatedValue = Number(
    orders.total_estimated_order_value_lkr || 0
  );

  const statusCounts = orders.orders_by_status || {};

  const orderDistribution = useMemo(
    () =>
      ORDER_STATUSES.map((item) => ({
        ...item,
        value: Number(statusCounts[item.key] || 0),
      })),
    [orderStats]
  );

  const highestStatus = Math.max(
    1,
    ...orderDistribution.map((item) => item.value)
  );

  const completedOrders = Number(statusCounts.completed || 0);

  const completionRate = getPercentage(
    completedOrders,
    totalOrders
  );

  const customerActiveRate = getPercentage(
    activeCustomers,
    totalCustomers
  );

  const shopApprovalRate = getPercentage(
    approvedShops,
    totalShops
  );

  const hasData = Boolean(userStats && orderStats);

  return (
    <main className="ar-page">
      {/* HEADER */}
      <header className="ar-hero">
        <div>
          <span className="ar-eyebrow">
            <Activity size={15} />
            MEALMATE ADMIN ANALYTICS
          </span>

          <h1>
            Reports & Analytics <span>✦</span>
          </h1>

          <p>
            Monitor customers, partner shops, order activity
            and estimated grocery basket values.
          </p>

          <span className="ar-live-label">
            <span className="ar-live-dot" />
            Live backend statistics
          </span>
        </div>

        <div className="ar-hero-right">
          <div className="ar-hero-icon">
            <BarChart3 size={55} strokeWidth={1.5} />
          </div>

          <button
            type="button"
            className="ar-refresh-btn"
            disabled={loading}
            onClick={() => setRefreshKey((prev) => prev + 1)}
          >
            <RefreshCw
              size={16}
              className={loading ? "ar-spin" : ""}
            />
            {loading ? "Refreshing..." : "Refresh Reports"}
          </button>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="ar-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {loading && !hasData && (
        <div className="ar-loading" role="status">
          <RefreshCw size={22} className="ar-spin" />
          Loading analytics data...
        </div>
      )}

      {hasData && (
        <>
          {/* SUMMARY CARDS */}
          <section className="ar-summary-grid">
            <ReportCard
              icon={Users}
              label="Total Customers"
              value={formatNumber(totalCustomers)}
              description="Registered customer accounts"
            />

            <ReportCard
              icon={Store}
              label="Partner Shops"
              value={formatNumber(totalShops)}
              description="Registered shop owners"
              variant="lime"
            />

            <ReportCard
              icon={ShoppingBasket}
              label="Total Orders"
              value={formatNumber(totalOrders)}
              description="Submitted grocery baskets"
            />

            <ReportCard
              icon={Wallet}
              label="Estimated Order Value"
              value={formatCurrency(estimatedValue)}
              description="Total estimated basket value"
              variant="lime"
            />
          </section>

          {/* ORDER ANALYTICS */}
          <section className="ar-section">
            <div className="ar-section-heading">
              <div>
                <span className="ar-section-eyebrow">
                  ORDER INSIGHTS
                </span>

                <h2>Order Analytics</h2>
                <p>
                  Overview of grocery basket order statuses.
                </p>
              </div>

              <span className="ar-section-tag">
                {formatNumber(totalOrders)} Orders
              </span>
            </div>

            <div className="ar-order-grid">
              {/* BAR CHART */}
              <article className="ar-panel">
                <div className="ar-panel-heading">
                  <div>
                    <h3>Order Status Distribution</h3>
                    <p>Orders grouped by current status</p>
                  </div>

                  <BarChart3 size={21} />
                </div>

                <div className="ar-chart">
                  {orderDistribution.map((item) => (
                    <div
                      className="ar-chart-column"
                      key={item.key}
                    >
                      <span className="ar-chart-value">
                        {formatNumber(item.value)}
                      </span>

                      <div className="ar-chart-track">
                        <div
                          className="ar-chart-bar"
                          style={{
                            height: `${
                              (item.value / highestStatus) * 100
                            }%`,
                            backgroundColor: item.color,
                          }}
                          title={`${item.label}: ${item.value}`}
                        />
                      </div>

                      <span className="ar-chart-label">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {totalOrders === 0 && (
                  <p className="ar-empty-note">
                    No orders have been recorded yet.
                  </p>
                )}
              </article>

              {/* STATUS BREAKDOWN */}
              <article className="ar-panel">
                <div className="ar-panel-heading">
                  <div>
                    <h3>Status Breakdown</h3>
                    <p>Percentage of total orders</p>
                  </div>

                  <Activity size={21} />
                </div>

                <div className="ar-distribution-list">
                  {orderDistribution.map((item) => (
                    <DistributionRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      total={totalOrders}
                      color={item.color}
                    />
                  ))}
                </div>
              </article>
            </div>
          </section>

          {/* CUSTOMER & SHOP ANALYTICS */}
          <section className="ar-section">
            <div className="ar-section-heading">
              <div>
                <span className="ar-section-eyebrow">
                  USER INSIGHTS
                </span>

                <h2>Customer & Partner Shop Analytics</h2>
                <p>
                  Account activity and partner approval overview.
                </p>
              </div>
            </div>

            <div className="ar-insight-grid">
              {/* CUSTOMER ANALYTICS */}
              <article className="ar-panel ar-insight-panel">
                <div className="ar-panel-heading">
                  <div>
                    <h3>Customer Accounts</h3>
                    <p>Active and inactive customers</p>
                  </div>

                  <Users size={22} />
                </div>

                <div className="ar-insight-total">
                  <strong>{formatNumber(totalCustomers)}</strong>
                  <span>Total Customers</span>
                </div>

                <div className="ar-progress-track ar-large-track">
                  <div
                    className="ar-progress-fill"
                    style={{
                      width: `${customerActiveRate}%`,
                      background: "#7dad35",
                    }}
                  />
                </div>

                <div className="ar-insight-stats">
                  <div>
                    <span className="ar-insight-stat-icon green">
                      <UserCheck size={19} />
                    </span>
                    <div>
                      <small>Active</small>
                      <strong>{formatNumber(activeCustomers)}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="ar-insight-stat-icon pink">
                      <UserX size={19} />
                    </span>
                    <div>
                      <small>Inactive</small>
                      <strong>{formatNumber(inactiveCustomers)}</strong>
                    </div>
                  </div>
                </div>

                <p className="ar-insight-footer">
                  {customerActiveRate}% of customers are active.
                </p>
              </article>

              {/* SHOP ANALYTICS */}
              <article className="ar-panel ar-insight-panel">
                <div className="ar-panel-heading">
                  <div>
                    <h3>Partner Shop Approvals</h3>
                    <p>Registration approval status</p>
                  </div>

                  <Store size={22} />
                </div>

                <div className="ar-insight-total">
                  <strong>{formatNumber(totalShops)}</strong>
                  <span>Total Partner Shops</span>
                </div>

                <div className="ar-shop-status-list">
                  <DistributionRow
                    label="Approved"
                    value={approvedShops}
                    total={totalShops}
                    color="#7dad35"
                  />

                  <DistributionRow
                    label="Pending"
                    value={pendingShops}
                    total={totalShops}
                    color="#e9b44d"
                  />

                  <DistributionRow
                    label="Rejected"
                    value={rejectedShops}
                    total={totalShops}
                    color="#d86b86"
                  />
                </div>

                <p className="ar-insight-footer">
                  {shopApprovalRate}% of partner shops are approved.
                </p>
              </article>
            </div>
          </section>

          {/* PERFORMANCE SUMMARY */}
          <section className="ar-section">
            <div className="ar-section-heading">
              <div>
                <span className="ar-section-eyebrow">
                  PERFORMANCE
                </span>

                <h2>Platform Summary</h2>
                <p>
                  Key operational metrics for MealMate.
                </p>
              </div>
            </div>

            <div className="ar-performance-grid">
              <div className="ar-performance-card">
                <span className="ar-performance-icon">
                  <CheckCircle2 size={23} />
                </span>
                <div>
                  <small>Completed Orders</small>
                  <strong>{formatNumber(completedOrders)}</strong>
                  <p>{completionRate}% of all orders</p>
                </div>
              </div>

              <div className="ar-performance-card">
                <span className="ar-performance-icon">
                  <Clock3 size={23} />
                </span>
                <div>
                  <small>Pending Orders</small>
                  <strong>
                    {formatNumber(statusCounts.pending || 0)}
                  </strong>
                  <p>Awaiting partner shop response</p>
                </div>
              </div>

              <div className="ar-performance-card">
                <span className="ar-performance-icon">
                  <CheckCircle2 size={23} />
                </span>
                <div>
                  <small>Approved Shops</small>
                  <strong>{formatNumber(approvedShops)}</strong>
                  <p>Approved partner accounts</p>
                </div>
              </div>

              <div className="ar-performance-card">
                <span className="ar-performance-icon">
                  <XCircle size={23} />
                </span>
                <div>
                  <small>Rejected Orders</small>
                  <strong>
                    {formatNumber(statusCounts.rejected || 0)}
                  </strong>
                  <p>Orders rejected by partner shops</p>
                </div>
              </div>
            </div>
          </section>

          <footer className="ar-footer-note">
            <Activity size={16} />
            Reports are generated from existing MealMate backend
            records. Order values are estimates, not confirmed revenue.
          </footer>
        </>
      )}
    </main>
  );
}
