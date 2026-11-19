
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Store, Clock3, CheckCircle2, XCircle, Search, RefreshCw,
  Eye, X, Mail, Phone, MapPin, CalendarDays, CreditCard,
  AlertTriangle
} from "lucide-react";
import "../styles/AdminDashboard.css";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getToken = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

async function api(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error("Please log in as an administrator.");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string" ? detail : `Request failed (${response.status})`
    );
  }

  return data;
}

const getList = (data) =>
  Array.isArray(data)
    ? data
    : ["shop_owners", "shops", "users", "items", "results", "data"]
        .map((key) => data?.[key])
        .find(Array.isArray) || [];

const statusOf = (shop) =>
  String(shop.approval_status || "pending").toLowerCase();

const parseUTC = (value) => {
  if (!value) return null;
  const normalized =
    typeof value === "string" && !/[zZ]$|[+-]\d\d:\d\d$/.test(value)
      ? `${value}Z`
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseUTC(value);
  return date ? date.toLocaleDateString("en-LK") : "—";
};

const subscriptionOf = (shop) =>
  shop.subscription ||
  shop.current_subscription ||
  shop.active_subscription ||
  null;

function subscriptionInfo(shop) {
  const approval = statusOf(shop);
  const sub = subscriptionOf(shop);

  const rawStatus = String(
    sub?.status || shop.subscription_status || ""
  ).toLowerCase();

  const planName =
    sub?.plan_name || shop.subscription_plan_name || "";

  const endDate =
    sub?.end_date || shop.subscription_end_date || null;

  const startDate =
    sub?.start_date || shop.subscription_start_date || null;

  const end = parseUTC(endDate);

  if (approval === "rejected") {
    return {
      status: "rejected",
      label: "Rejected",
      planName,
      startDate,
      endDate,
      daysRemaining: 0,
    };
  }

  if (approval === "pending") {
    return {
      status: "pending",
      label: "Pending Approval",
      planName,
      startDate,
      endDate,
      daysRemaining: 0,
    };
  }

  if (!rawStatus && !endDate) {
    return {
      status: "unknown",
      label: "Not Available",
      planName,
      startDate,
      endDate,
      daysRemaining: 0,
    };
  }

  const active =
    rawStatus === "active" &&
    end !== null &&
    end.getTime() > Date.now();

  const daysRemaining = active
    ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
    : 0;

  if (active) {
    const trial = planName.toLowerCase().includes("trial");
    return {
      status: trial ? "trial" : "active",
      label: trial ? "Free Trial" : "Active",
      planName,
      startDate,
      endDate,
      daysRemaining,
    };
  }

  return {
    status: "overdue",
    label: "Overdue",
    planName,
    startDate,
    endDate,
    daysRemaining: 0,
  };
}

export default function AdminShopOwners() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const reload = useCallback(() => setRefresh((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError("");

      try {
        const data = await api("/admin/shop-owners", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setShops(getList(data));
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [refresh]);

  const counts = useMemo(() => ({
    all: shops.length,
    pending: shops.filter((s) => statusOf(s) === "pending").length,
    approved: shops.filter((s) => statusOf(s) === "approved").length,
    rejected: shops.filter((s) => statusOf(s) === "rejected").length,
    trial: shops.filter((s) => subscriptionInfo(s).status === "trial").length,
    active: shops.filter((s) => subscriptionInfo(s).status === "active").length,
    overdue: shops.filter((s) => subscriptionInfo(s).status === "overdue").length,
  }), [shops]);

  const visible = useMemo(() => shops.filter((shop) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = [
      shop.shop_name, shop.full_name, shop.email,
      shop.phone, shop.address, shop.id
    ].some((v) => String(v ?? "").toLowerCase().includes(q));

    const matchesFilter =
      filter === "all" ||
      (["trial", "active", "overdue"].includes(filter)
        ? subscriptionInfo(shop).status === filter
        : statusOf(shop) === filter);

    return matchesSearch && matchesFilter;
  }), [shops, search, filter]);

  function decide(shop, action) {
    if (busyId !== null) return;

    const approval = statusOf(shop);
    const subStatus = subscriptionInfo(shop).status;

    const canApprove = action === "approve" && approval === "pending";
    const canReject =
      action === "reject" &&
      (approval === "pending" ||
        (approval === "approved" && subStatus === "overdue"));

    if (!canApprove && !canReject) return;

    setConfirmation({ shop, action });
  }

  function closeConfirmation() {
    if (busyId !== null) return;
    setConfirmation(null);
  }

  async function confirmDecision() {
    if (!confirmation || busyId !== null) return;

    const { shop, action } = confirmation;
    const approval = statusOf(shop);
    const subStatus = subscriptionInfo(shop).status;

    if (
      action === "approve" && approval !== "pending"
    ) return;

    if (
      action === "reject" &&
      !(approval === "pending" ||
        (approval === "approved" && subStatus === "overdue"))
    ) return;

    setBusyId(shop.id);
    setError("");
    setNotice("");

    try {
      const updated = await api(
        `/admin/shop-owners/${shop.id}/${action}`,
        { method: "PATCH" }
      );

      const next = {
        ...shop,
        ...updated,
        approval_status: action === "approve" ? "approved" : "rejected",
      };

      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? next : s))
      );

      setSelected((prev) =>
        prev?.id === shop.id ? next : prev
      );

      setNotice(
        `${shop.shop_name || shop.full_name || "Shop owner"} ${
          action === "approve" ? "approved" : "rejected"
        } successfully.`
      );

      setConfirmation(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const selectedSubscription = selected
    ? subscriptionInfo(selected)
    : null;

  return (
    <main className="aso-page">
      <header className="aso-hero">
        <div>
          <span className="aso-eyebrow">
            <Store size={15} /> MEALMATE ADMIN
          </span>
          <h1>Partner Shop Management <span>✦</span></h1>
          <p>
            Review registrations, manage subscriptions and keep
            your marketplace organized.
          </p>
          <button
            type="button"
            className="aso-refresh"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "aso-spin" : ""} />
            Refresh Shops
          </button>
        </div>
        <div className="aso-hero-icon" aria-hidden="true">
          <Store size={74} strokeWidth={1.4} />
        </div>
      </header>

      {error && <div className="aso-alert aso-error" role="alert">{error}</div>}
      {notice && <div className="aso-alert aso-success" role="status">{notice}</div>}

      <section className="aso-stats" aria-label="Shop owner counts">
        {[
          { label: "Total Shop Owners", key: "all", icon: Store },
          { label: "Pending Approval", key: "pending", icon: Clock3 },
          { label: "Approved Shops", key: "approved", icon: CheckCircle2 },
          { label: "Rejected Shops", key: "rejected", icon: XCircle },
          { label: "Free Trial", key: "trial", icon: Clock3 },
          { label: "Paid Active", key: "active", icon: CreditCard },
          { label: "Overdue", key: "overdue", icon: AlertTriangle },
        ].map(({ label, key, icon: Icon }) => (
          <div className="aso-stat" key={key}>
            <span className="aso-stat-icon"><Icon size={23} /></span>
            <span className="aso-stat-label">{label}</span>
            <strong>{loading ? "…" : counts[key]}</strong>
          </div>
        ))}
      </section>

      <section className="aso-panel">
        <div className="aso-panel-header">
          <div>
            <h2>Registered Partner Shops</h2>
            <p>Search and manage shop owner subscriptions</p>
          </div>
          <span className="aso-result-count">{visible.length} results</span>
        </div>

        <div className="aso-toolbar">
          <label className="aso-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shop, owner, email or phone"
              aria-label="Search shop owners"
            />
          </label>

          <div className="aso-filters" aria-label="Filter shops">
            {[
              "all", "pending", "approved", "rejected",
              "trial", "active", "overdue"
            ].map((key) => (
              <button
                type="button"
                key={key}
                className={filter === key ? "aso-filter active" : "aso-filter"}
                onClick={() => setFilter(key)}
              >
                {key === "all"
                  ? "All"
                  : key.charAt(0).toUpperCase() + key.slice(1)}
                <span>{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="aso-table-scroll">
          <table className="aso-table">
            <thead>
              <tr>
                <th>Shop / Owner</th>
                <th>Contact</th>
                <th>Joined</th>
                <th>Approval</th>
                <th>Subscription</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((shop) => {
                const sub = subscriptionInfo(shop);
                const canReject =
                  statusOf(shop) === "pending" ||
                  (statusOf(shop) === "approved" && sub.status === "overdue");

                return (
                  <tr key={shop.id}>
                    <td>
                      <strong>{shop.shop_name || "Unnamed Shop"}</strong>
                      <small>{shop.full_name || "—"} · ID #{shop.id}</small>
                    </td>
                    <td>
                      <span>{shop.email || "—"}</span>
                      <small>{shop.phone || ""}</small>
                    </td>
                    <td>{formatDate(shop.created_at)}</td>
                    <td>
                      <span className={`aso-status aso-${statusOf(shop)}`}>
                        {statusOf(shop)}
                      </span>
                    </td>
                    <td>
                      <span className={`aso-status aso-${sub.status}`}>
                        {sub.label}
                      </span>
                      {sub.status === "trial" && (
                        <small>{sub.daysRemaining} days remaining</small>
                      )}
                    </td>
                    <td>{formatDate(sub.endDate)}</td>
                    <td>
                      <div className="aso-actions">
                        <button
                          type="button"
                          className="aso-view"
                          onClick={() => setSelected(shop)}
                        >
                          <Eye size={15} /> View
                        </button>

                        {statusOf(shop) === "pending" && (
                          <button
                            type="button"
                            className="aso-approve"
                            disabled={busyId !== null}
                            onClick={() => decide(shop, "approve")}
                          >
                            <CheckCircle2 size={15} /> Approve
                          </button>
                        )}

                        {canReject && (
                          <button
                            type="button"
                            className="aso-reject"
                            disabled={busyId !== null}
                            onClick={() => decide(shop, "reject")}
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="aso-empty">No shop owners found.</td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={7} className="aso-empty">
                    Loading partner shops…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div
          className="aso-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !confirmation)
              setSelected(null);
          }}
        >
          <section
            className="aso-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aso-modal-title"
          >
            <div className="aso-modal-header">
              <div>
                <span className="aso-eyebrow">SHOP OWNER DETAILS</span>
                <h2 id="aso-modal-title">
                  {selected.shop_name || "Partner Shop"}
                </h2>
              </div>
              <button
                type="button"
                className="aso-close"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="aso-detail-list">
              <div><Store size={18}/><span>Shop Name</span><strong>{selected.shop_name || "—"}</strong></div>
              <div><Store size={18}/><span>Owner Name</span><strong>{selected.full_name || "—"}</strong></div>
              <div><Mail size={18}/><span>Email</span><strong>{selected.email || "—"}</strong></div>
              <div><Phone size={18}/><span>Phone</span><strong>{selected.phone || "—"}</strong></div>
              <div><MapPin size={18}/><span>Address</span><strong>{selected.address || "—"}</strong></div>
              <div><CalendarDays size={18}/><span>Registered</span><strong>{formatDate(selected.created_at)}</strong></div>
              <div>
                <CheckCircle2 size={18}/>
                <span>Approval</span>
                <strong>{statusOf(selected)}</strong>
              </div>
              <div>
                <CreditCard size={18}/>
                <span>Subscription</span>
                <strong>{selectedSubscription.label}</strong>
              </div>
              <div>
                <CreditCard size={18}/>
                <span>Plan</span>
                <strong>{selectedSubscription.planName || "—"}</strong>
              </div>
              <div>
                <CalendarDays size={18}/>
                <span>Start Date</span>
                <strong>{formatDate(selectedSubscription.startDate)}</strong>
              </div>
              <div>
                <CalendarDays size={18}/>
                <span>Expiry Date</span>
                <strong>{formatDate(selectedSubscription.endDate)}</strong>
              </div>
              {selectedSubscription.status === "trial" && (
                <div>
                  <Clock3 size={18}/>
                  <span>Trial Remaining</span>
                  <strong>{selectedSubscription.daysRemaining} Days</strong>
                </div>
              )}
            </div>

            {(statusOf(selected) === "pending" ||
              (statusOf(selected) === "approved" &&
                selectedSubscription.status === "overdue")) && (
              <div className="aso-modal-actions">
                {statusOf(selected) === "pending" && (
                  <button
                    type="button"
                    className="aso-approve"
                    disabled={busyId !== null}
                    onClick={() => decide(selected, "approve")}
                  >
                    Approve Shop
                  </button>
                )}
                <button
                  type="button"
                  className="aso-reject"
                  disabled={busyId !== null}
                  onClick={() => decide(selected, "reject")}
                >
                  Reject Shop
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {confirmation && (
        <div
          className="aso-confirm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirmation();
          }}
        >
          <section
            className="aso-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="aso-confirm-title"
            aria-describedby="aso-confirm-description"
          >
            <button
              type="button"
              className="aso-confirm-close"
              aria-label="Close confirmation"
              disabled={busyId !== null}
              onClick={closeConfirmation}
            >
              <X size={20} />
            </button>

            <div className={`aso-confirm-icon ${confirmation.action}`}>
              {confirmation.action === "approve"
                ? <CheckCircle2 size={32} />
                : <XCircle size={32} />}
            </div>

            <h2 id="aso-confirm-title">
              {confirmation.action === "approve"
                ? "Approve Partner Shop?"
                : "Reject Partner Shop?"}
            </h2>

            <p id="aso-confirm-description">
              Are you sure you want to {confirmation.action} this shop owner?
            </p>

            <div className="aso-confirm-shop">
              <span className="aso-confirm-shop-icon">
                <Store size={22} />
              </span>
              <div>
                <strong>{confirmation.shop.shop_name || "Unnamed Shop"}</strong>
                <small>
                  {confirmation.shop.full_name ||
                    confirmation.shop.email ||
                    "Shop owner"}
                </small>
              </div>
            </div>

            <p className="aso-confirm-note">
              {confirmation.action === "approve"
                ? "Approval starts the new shop owner's 30-day free trial."
                : "This shop owner will be marked as rejected and hidden from the customer shop list."}
            </p>

            <div className="aso-confirm-actions">
              <button
                type="button"
                className="aso-confirm-cancel"
                onClick={closeConfirmation}
                disabled={busyId !== null}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`aso-confirm-submit ${confirmation.action}`}
                onClick={confirmDecision}
                disabled={busyId !== null}
              >
                {busyId !== null
                  ? "Processing..."
                  : confirmation.action === "approve"
                  ? "Yes, Approve"
                  : "Yes, Reject"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
