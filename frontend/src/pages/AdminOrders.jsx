import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBasket, Clock3, CheckCircle2, Search, RefreshCw, Eye, X, UserRound, Store, CalendarDays, Wallet, Package, AlertCircle } from "lucide-react";
import "../styles/AdminDashboard.css";


const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const getToken = () => localStorage.getItem("mealmate_token") || localStorage.getItem("access_token") || localStorage.getItem("token");

async function api(path, options = {}) {
  const accessToken = getToken();
  if (!accessToken) throw new Error("Please log in as an administrator.");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (${response.status}).`);
  return body;
}

const getOrders = (data) => Array.isArray(data) ? data : ["orders", "items", "results", "data"].map((key) => data?.[key]).find(Array.isArray) || [];
const orderId = (order) => order.order_id ?? order.id;
const statusOf = (order) => String(order.status || "unknown").toLowerCase();
const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const dateText = (value) => value ? new Date(value).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" }) : "—";

function BasketSnapshot({ snapshot }) {
  if (!snapshot) return <p className="ao-muted">No basket snapshot is available for this order.</p>;
  let data = snapshot;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return <p className="ao-muted">{data}</p>; }
  }
  const items = Array.isArray(data) ? data : [data?.items, data?.basket_items, data?.grocery_items, data?.products].find(Array.isArray);
  if (!items) {
    return <pre className="ao-snapshot-json">{JSON.stringify(data, null, 2)}</pre>;
  }
  return <div className="ao-basket-scroll"><table className="ao-basket-table"><thead><tr><th>Item</th><th>Quantity</th><th>Price</th></tr></thead><tbody>
    {items.map((item, index) => <tr key={item.id ?? index}><td>{item.name || item.item_name || item.food_name || item.product_name || `Item ${index + 1}`}</td><td>{item.quantity ?? item.qty ?? "—"} {item.unit || ""}</td><td>{item.total_price_lkr != null ? money(item.total_price_lkr) : item.total_price != null ? money(item.total_price) : item.price_lkr != null ? money(item.price_lkr) : item.price != null ? money(item.price) : "—"}</td></tr>)}
  </tbody></table></div>;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [orderResult, statsResult] = await Promise.allSettled([
          api("/admin/orders", { signal: controller.signal }),
          api("/admin/dashboard/orders", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (orderResult.status === "fulfilled") setOrders(getOrders(orderResult.value));
        else { setOrders([]); setError(orderResult.reason.message); }
        if (statsResult.status === "fulfilled") setStats(statsResult.value);
        else setStats(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [refreshKey]);

  const statuses = useMemo(() => [...new Set(orders.map(statusOf))].sort(), [orders]);
  const visible = useMemo(() => orders.filter((order) => {
    const q = search.trim().toLowerCase();
    const matches = [orderId(order), order.customer_id, order.shop_id, order.grocery_basket_id, order.customer?.full_name, order.shop?.shop_name]
      .some((value) => String(value ?? "").toLowerCase().includes(q));
    return matches && (filter === "all" || statusOf(order) === filter);
  }), [orders, search, filter]);

  const statusCounts = stats?.orders_by_status || {};
  const pendingCount = Object.entries(statusCounts).filter(([key]) => ["pending", "placed"].includes(key.toLowerCase())).reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const completedCount = Object.entries(statusCounts).filter(([key]) => ["completed", "delivered"].includes(key.toLowerCase())).reduce((sum, [, count]) => sum + Number(count || 0), 0);

  const viewOrder = useCallback(async (order) => {
    setSelected(order);
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const details = await api(`/admin/orders/${orderId(order)}`);
      setSelected((previous) => previous && orderId(previous) === orderId(order) ? details : previous);
    } catch (err) {
      setDetailsError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  return <main className="ao-page">
    <header className="ao-hero"><div><span className="ao-eyebrow"><ShoppingBasket size={15}/> MEALMATE ADMIN</span><h1>Order Management <span>✦</span></h1><p>Monitor weekly grocery basket orders and review customer and partner shop details.</p></div><button type="button" className="ao-refresh" onClick={() => setRefreshKey((n) => n + 1)} disabled={loading}><RefreshCw size={16} className={loading ? "ao-spin" : ""}/> Refresh Orders</button></header>
    {error && <div className="ao-alert" role="alert"><AlertCircle size={18}/>{error}</div>}
    <section className="ao-stats" aria-label="Order statistics">
      <div className="ao-stat"><span className="ao-stat-icon"><ShoppingBasket size={22}/></span><span>Total Orders</span><strong>{loading ? "…" : stats?.total_orders ?? orders.length}</strong></div>
      <div className="ao-stat"><span className="ao-stat-icon"><Clock3 size={22}/></span><span>Pending / Placed</span><strong>{loading ? "…" : stats ? pendingCount : orders.filter(o => ["pending", "placed"].includes(statusOf(o))).length}</strong></div>
      <div className="ao-stat"><span className="ao-stat-icon"><CheckCircle2 size={22}/></span><span>Completed / Delivered</span><strong>{loading ? "…" : stats ? completedCount : orders.filter(o => ["completed", "delivered"].includes(statusOf(o))).length}</strong></div>
      <div className="ao-stat"><span className="ao-stat-icon"><Wallet size={22}/></span><span>Estimated Order Value</span><strong className="ao-money-stat">{loading ? "…" : money(stats?.total_estimated_order_value_lkr ?? orders.reduce((sum, order) => sum + Number(order.estimated_total_lkr || 0), 0))}</strong></div>
    </section>
    <section className="ao-panel"><div className="ao-panel-head"><div><h2>All Grocery Basket Orders</h2><p>Browse orders and open their full details</p></div><span className="ao-count">{visible.length} results</span></div>
      <div className="ao-toolbar"><label className="ao-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer ID, shop ID" aria-label="Search orders"/></label><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter order status"><option value="all">All Statuses</option>{statuses.map(s => <option value={s} key={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
      <div className="ao-table-scroll"><table className="ao-table"><thead><tr><th>Order</th><th>Customer ID</th><th>Partner Shop ID</th><th>Estimated Total</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="ao-empty">Loading orders...</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="ao-empty">No orders found.</td></tr> : visible.map(order => <tr key={orderId(order)}><td><strong>#{orderId(order)}</strong><small>Basket #{order.grocery_basket_id ?? "—"}</small></td><td>#{order.customer_id ?? "—"}</td><td>#{order.shop_id ?? "—"}</td><td>{money(order.estimated_total_lkr)}</td><td>{dateText(order.created_at)}</td><td><span className={`ao-status ao-status-${statusOf(order).replace(/[^a-z0-9-]/g, "")}`}>{statusOf(order)}</span></td><td><button className="ao-view" type="button" onClick={() => viewOrder(order)}><Eye size={15}/> View Details</button></td></tr>)}
      </tbody></table></div>
    </section>
    {selected && <div className="ao-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><section className="ao-modal" role="dialog" aria-modal="true" aria-labelledby="ao-modal-title"><div className="ao-modal-head"><div><span className="ao-eyebrow">ORDER DETAILS</span><h2 id="ao-modal-title">Order #{orderId(selected)}</h2></div><button type="button" className="ao-close" onClick={() => setSelected(null)} aria-label="Close order details"><X size={20}/></button></div>
      {detailsLoading ? <p className="ao-muted">Loading order details...</p> : <>
        {detailsError && <div className="ao-alert" role="alert">{detailsError}</div>}
        <div className="ao-detail-grid"><div><CalendarDays size={17}/><span>Order Date</span><strong>{dateText(selected.created_at)}</strong></div><div><Package size={17}/><span>Status</span><strong className="ao-capitalize">{statusOf(selected)}</strong></div><div><Wallet size={17}/><span>Estimated Total</span><strong>{money(selected.estimated_total_lkr)}</strong></div><div><ShoppingBasket size={17}/><span>Basket ID</span><strong>#{selected.grocery_basket_id ?? "—"}</strong></div></div>
        <div className="ao-party-grid"><div className="ao-party"><h3><UserRound size={18}/> Customer</h3><strong>{selected.customer?.full_name || `Customer #${selected.customer_id ?? "—"}`}</strong><p>{selected.customer?.email || "Email not available"}</p></div><div className="ao-party"><h3><Store size={18}/> Partner Shop</h3><strong>{selected.shop?.shop_name || `Shop #${selected.shop_id ?? "—"}`}</strong><p>{selected.shop?.email || "Email not available"}</p>{selected.shop?.phone && <p>{selected.shop.phone}</p>}{selected.shop?.address && <p>{selected.shop.address}</p>}</div></div>
        <div className="ao-basket"><h3><ShoppingBasket size={18}/> Grocery Basket Snapshot</h3><BasketSnapshot snapshot={selected.basket_snapshot}/></div>
        <p className="ao-footnote">Order status is read-only here because the current Admin API does not expose a status-update endpoint.</p>
      </>}
    </section></div>}
  </main>;
}
