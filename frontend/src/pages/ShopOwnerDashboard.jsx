
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Store,
  ShoppingBasket,
  Clock3,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  AlertCircle,
  UserRound,
  BarChart3,
  ArrowRight,
  Zap,
  Package,
  TrendingUp,
} from "lucide-react";

import api, {
  getShopOwnerProfile,
} from "../services/api";

import ShopOwnerLayout from "../components/ShopOwnerLayout";
import "../styles/ShopOwnerDashboard.css";

const ACTIVE_STATUSES = [
  "accepted",
  "preparing",
  "ready",
];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const money = (value) => {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? `Rs. ${amount.toLocaleString("en-LK", {
        maximumFractionDigits: 2,
      })}`
    : "Amount unavailable";
};

const orderDate = (order) => {
  const raw =
    order?.created_at ||
    order?.ordered_at ||
    order?.createdAt;

  if (!raw) return null;

  const date = new Date(raw);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

export default function ShopOwnerDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("7");

  // LOAD SHOP PROFILE AND ORDERS
  const loadData = useCallback(
    async (initial = false) => {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const [
          profileResponse,
          ordersResponse,
        ] = await Promise.all([
          getShopOwnerProfile(),
          api.get("/orders/shop/received"),
        ]);

        setProfile(profileResponse.data);

        const data = ordersResponse.data;

        setOrders(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.orders)
              ? data.orders
              : []
        );
      } catch (err) {
        if (
          [401, 403].includes(
            err.response?.status
          )
        ) {
          [
            "mealmate_token",
            "access_token",
            "token",
          ].forEach((key) => {
            localStorage.removeItem(key);
          });

          navigate("/login", {
            replace: true,
          });

          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load shop orders."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // PROFILE UPDATE LISTENER
  useEffect(() => {
    let active = true;

    const refreshProfile = async () => {
      try {
        const response =
          await getShopOwnerProfile();

        if (active) {
          setProfile(response.data);
        }
      } catch (err) {
        console.error(
          "Unable to refresh shop owner profile:",
          err
        );
      }
    };

    window.addEventListener(
      "mealmate:shop-profile-updated",
      refreshProfile
    );

    return () => {
      active = false;

      window.removeEventListener(
        "mealmate:shop-profile-updated",
        refreshProfile
      );
    };
  }, []);

  // ORDER STATISTICS
  const stats = useMemo(
    () => ({
      total: orders.length,

      pending: orders.filter(
        (order) =>
          order.status === "pending"
      ).length,

      active: orders.filter(
        (order) =>
          ACTIVE_STATUSES.includes(
            order.status
          )
      ).length,

      completed: orders.filter(
        (order) =>
          order.status === "completed"
      ).length,

      other: orders.filter(
        (order) =>
          ["cancelled", "rejected"].includes(
            order.status
          )
      ).length,
    }),
    [orders]
  );

  // CHART DATA
  const chartData = useMemo(() => {
    const days = Number(period);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return Array.from(
      { length: days },
      (_, index) => {
        const date = new Date(today);

        date.setDate(
          today.getDate() -
            days +
            index +
            1
        );

        const count = orders.filter(
          (order) => {
            const created =
              orderDate(order);

            return (
              created &&
              created.toDateString() ===
                date.toDateString()
            );
          }
        ).length;

        return {
          label: date.toLocaleDateString(
            "en-US",
            {
              weekday: "short",
            }
          ),

          date: date.toLocaleDateString(
            "en-LK"
          ),

          count,
        };
      }
    );
  }, [orders, period]);

  const chartMax = Math.max(
    1,
    ...chartData.map(
      (day) => day.count
    )
  );

  // RECENT ORDERS
  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            (orderDate(b)?.getTime() ||
              0) -
            (orderDate(a)?.getTime() ||
              0)
        )
        .slice(0, 3),
    [orders]
  );

  // ORDER STATUS DONUT
  const donut = useMemo(() => {
    if (!stats.total) {
      return "conic-gradient(#eee5f0 0 100%)";
    }

    const segments = [
      [stats.pending, "#9ddd2e"],
      [stats.active, "#922ba8"],
      [stats.completed, "#b38bf2"],
      [stats.other, "#d9d0dd"],
    ];

    let start = 0;

    const stops = segments.map(
      ([count, color]) => {
        const end =
          start +
          (count / stats.total) * 100;

        const stop =
          `${color} ${start}% ${end}%`;

        start = end;

        return stop;
      }
    );

    return `conic-gradient(${stops.join(", ")})`;
  }, [stats]);

  // NAVIGATION
  const goOrders = () => {
    navigate("/shop/orders");
  };

  const goProfile = () => {
    navigate("/shop-owner/profile");
  };

  return (
    <ShopOwnerLayout
      profile={profile}
      onOrdersClick={goOrders}
    >
      <div className="so-content mm-final-dashboard">

        {/* HERO SECTION */}
        <section className="mm-final-hero mm-grocery-style-hero">

          <div className="mm-final-hero-copy">

            <span className="mm-final-eyebrow">
              <ShoppingBasket size={15} />
              MEALMATE PARTNER NETWORK
            </span>

            <h2>
              Welcome back,{" "}
              <span className="mm-hero-name">
                {profile?.shop_name ||
                  profile?.full_name ||
                  "Shop Owner"}
                !
              </span>
            </h2>

            <p>
              Manage customer grocery baskets,
              track incoming orders, and keep
              every order moving smoothly.
            </p>

            <div className="mm-hero-chips">

              <span>
                <ShoppingBasket size={15} />
                Manage baskets
              </span>

              <span>
                <Clock3 size={15} />
                Track orders
              </span>

              <span>
                <CheckCircle2 size={15} />
                Trusted partner
              </span>

            </div>
          </div>

          <div
            className="mm-final-hero-art"
            aria-hidden="true"
          >
            <div className="mm-final-hero-circle" />

            <span className="mm-hero-float mm-hero-float-one">
              <ShoppingBasket size={21} />
            </span>

            <img
              className="mm-hero-shop-image"
              src="/images/partner-shop-hero.png"
              alt=""
            />

            <span className="mm-hero-float mm-hero-float-two">
              <CheckCircle2 size={21} />
            </span>

            <span className="mm-hero-float mm-hero-float-three">
              <PackageCheck size={21} />
            </span>
          </div>
        </section>

        {/* ORDER STATISTICS */}
        <section
          className="mm-final-stats"
          aria-label="Order statistics"
        >
          {[
            {
              title: "Total Orders",
              count: stats.total,
              description: "All received baskets",
              icon: ShoppingBasket,
              theme: "pink",
            },
            {
              title: "Pending Orders",
              count: stats.pending,
              description: "Waiting for your response",
              icon: Clock3,
              theme: "lime",
            },
            {
              title: "In Progress",
              count: stats.active,
              description: "Accepted, preparing or ready",
              icon: PackageCheck,
              theme: "violet",
            },
            {
              title: "Completed",
              count: stats.completed,
              description: "Successfully completed",
              icon: CheckCircle2,
              theme: "rose",
            },
          ].map(
            ({
              title,
              count,
              description,
              icon: Icon,
              theme,
            }) => (
              <div
                className={`mm-final-stat mm-final-stat-${theme}`}
                key={title}
              >
                <span className="mm-final-stat-icon">
                  <Icon size={25} />
                </span>

                <span className="mm-final-stat-title">
                  {title}
                </span>

                <strong>{count}</strong>

                <small>{description}</small>
              </div>
            )
          )}
        </section>

        {/* ERROR MESSAGE */}
        {error && (
          <div
            className="mm-final-error"
            role="alert"
          >
            <AlertCircle size={19} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() => loadData(false)}
            >
              Retry
            </button>
          </div>
        )}

        {/* DASHBOARD PANELS */}
        <div className="mm-final-panels">

          {/* ORDER OVERVIEW */}
          <section className="mm-final-panel">

            <div className="mm-final-panel-header">
              <h3>
                <span className="mm-final-panel-icon">
                  <BarChart3 size={23} />
                </span>
                Order Overview
              </h3>

              <select
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value)
                }
                aria-label="Chart time period"
              >
                <option value="7">
                  Last 7 Days
                </option>

                <option value="14">
                  Last 14 Days
                </option>
              </select>
            </div>

            <div
              className="mm-final-chart"
              role="img"
              aria-label="Orders received per day"
            >
              <div className="mm-final-chart-plot">
                {chartData.map(
                  (day, index) => (
                    <div
                      className="mm-final-chart-day"
                      key={`${day.date}-${index}`}
                      title={`${day.date}: ${day.count} orders`}
                    >
                      <span className="mm-final-chart-value">
                        {day.count || ""}
                      </span>

                      <div
                        className={`mm-final-chart-bar ${
                          index % 2
                            ? "purple"
                            : "green"
                        }`}
                        style={{
                          height: `${
                            day.count
                              ? Math.max(
                                  4,
                                  (day.count /
                                    chartMax) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />

                      <span className="mm-final-chart-label">
                        {day.label}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

          {/* ORDER STATUS */}
          <section className="mm-final-panel">

            <div className="mm-final-panel-header">
              <h3>
                <span className="mm-final-panel-icon">
                  <Package size={23} />
                </span>
                Order Status
              </h3>
            </div>

            <div className="mm-final-status-body">

              <div
                className="mm-final-donut"
                style={{
                  background: donut,
                }}
              >
                <div className="mm-final-donut-hole">
                  <strong>
                    {stats.total}
                  </strong>

                  <span>Orders</span>
                </div>
              </div>

              <div className="mm-final-legend">

                <div>
                  <i className="pending" />
                  Pending
                  <strong>
                    {stats.pending}
                  </strong>
                </div>

                <div>
                  <i className="progress" />
                  In Progress
                  <strong>
                    {stats.active}
                  </strong>
                </div>

                <div>
                  <i className="completed" />
                  Completed
                  <strong>
                    {stats.completed}
                  </strong>
                </div>

                {stats.other > 0 && (
                  <div>
                    <i className="other" />
                    Cancelled / Rejected
                    <strong>
                      {stats.other}
                    </strong>
                  </div>
                )}

              </div>
            </div>
          </section>

          {/* RECENT ORDERS */}
          <section className="mm-final-panel">

            <div className="mm-final-panel-header">
              <h3>
                <span className="mm-final-panel-icon">
                  <ShoppingBasket size={23} />
                </span>
                Recent Orders
              </h3>

              <button
                type="button"
                className="mm-final-text-link"
                onClick={goOrders}
              >
                View All
                <ArrowRight size={17} />
              </button>
            </div>

            <div className="mm-final-order-list">

              {recentOrders.length === 0 ? (
                <div className="mm-final-empty">
                  No recent orders yet.
                </div>
              ) : (
                recentOrders.map((order) => {
                  const date = orderDate(order);

                  const amount =
                    order.total_price_lkr ??
                    order.total_amount ??
                    order.total_price ??
                    order.estimated_total_price_lkr;

                  return (
                    <button
                      type="button"
                      className="mm-final-order"
                      key={order.id}
                      onClick={() =>
                        navigate(
                          `/shop/orders/${order.id}/details`
                        )
                      }
                    >
                      <span className="mm-final-order-id">
                        #ORD{order.id}
                      </span>

                      <span className="mm-final-order-customer">
                        <span className="mm-final-user-icon">
                          <UserRound size={20} />
                        </span>

                        <span>
                          <strong>
                            {order.customer_name ||
                              `Customer #${
                                order.customer_id ||
                                order.id
                              }`}
                          </strong>

                          <small>
                            {date
                              ? date.toLocaleString(
                                  "en-LK",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }
                                )
                              : "Date unavailable"}
                          </small>
                        </span>
                      </span>

                      <strong className="mm-final-order-price">
                        {amount == null
                          ? "—"
                          : money(amount)}
                      </strong>

                      <span
                        className={`mm-final-status-pill ${
                          order.status || "unknown"
                        }`}
                      >
                        {STATUS_LABELS[
                          order.status
                        ] ||
                          order.status ||
                          "Unknown"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* QUICK ACTIONS */}
          <section className="mm-final-panel">

            <div className="mm-final-panel-header">
              <h3>
                <span className="mm-final-panel-icon">
                  <Zap size={23} />
                </span>
                Quick Actions
              </h3>
            </div>

            <div className="mm-final-actions">

              <button
                type="button"
                className="pink"
                onClick={goOrders}
              >
                <ShoppingBasket size={27} />
                <span>
                  View Received Orders
                </span>
              </button>

              <button
                type="button"
                className="lime"
                onClick={goProfile}
              >
                <Store size={27} />
                <span>
                  Edit Shop Profile
                </span>
              </button>

              <button
                type="button"
                className="green"
                onClick={() =>
                  loadData(false)
                }
                disabled={refreshing}
              >
                <RefreshCw size={27} />

                <span>
                  {refreshing
                    ? "Refreshing..."
                    : "Refresh Orders"}
                </span>
              </button>

              <button
                type="button"
                className="purple"
                onClick={goOrders}
              >
                <TrendingUp size={27} />
                <span>
                  Manage Orders
                </span>
              </button>

            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="mm-final-footer">
          © MealMate Partner Portal ·
          Plan Smart. Eat Healthy.
        </footer>

      </div>
    </ShopOwnerLayout>
  );
}
