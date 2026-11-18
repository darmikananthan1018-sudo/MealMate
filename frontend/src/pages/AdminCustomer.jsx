
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Eye,
  X,
  Mail,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import "../styles/AdminDashboard.css";


const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const token = () =>
  localStorage.getItem("mealmate_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token");

async function request(path, options = {}) {
  const accessToken = token();

  if (!accessToken) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail;

    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (${response.status}).`
    );
  }

  return body;
}

function extractCustomers(data) {
  if (Array.isArray(data)) return data;

  for (const key of [
    "customers",
    "users",
    "items",
    "data",
    "results",
  ]) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

const customerActive = (customer) =>
  customer?.is_active === true ||
  customer?.is_active === 1;

const readableDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-LK")
    : "—";

export default function AdminCustomer() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Custom confirmation modal
  const [confirmCustomer, setConfirmCustomer] = useState(null);

  const loadCustomers = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/admin/customers", {
        signal,
      });

      if (!signal?.aborted) {
        setCustomers(extractCustomers(data));
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.message);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadCustomers(controller.signal);

    return () => controller.abort();
  }, [loadCustomers, refreshKey]);

  const filtered = useMemo(() => {
    return customers.filter((customer) => {
      const matchesQuery = [
        customer.full_name,
        customer.email,
        customer.id,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );

      const matchesFilter =
        filter === "all" ||
        (filter === "active"
          ? customerActive(customer)
          : !customerActive(customer));

      return matchesQuery && matchesFilter;
    });
  }, [customers, query, filter]);

  const activeCount =
    customers.filter(customerActive).length;

  async function viewCustomer(customer) {
    setSelected(customer);
    setDetailsLoading(true);
    setError("");

    try {
      const data = await request(
        `/admin/customers/${customer.id}`
      );

      setSelected((previous) =>
        previous?.id === customer.id
          ? data?.customer || data?.user || data
          : previous
      );
    } catch (err) {
      setError(`Customer details: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  }

  // Open custom confirmation modal
  function openStatusConfirmation(customer) {
    if (busyId !== null) return;

    setConfirmCustomer(customer);
  }

  // Close confirmation modal
  function closeStatusConfirmation() {
    if (busyId !== null) return;

    setConfirmCustomer(null);
  }

  // Confirm and update backend
  async function confirmStatusChange() {
    if (!confirmCustomer || busyId !== null) return;

    const customer = confirmCustomer;
    const activate = !customerActive(customer);

    const action = activate
      ? "activate"
      : "deactivate";

    setBusyId(customer.id);
    setError("");
    setNotice("");

    try {
      await request(
        `/admin/customers/${customer.id}/${action}`,
        {
          method: "PATCH",
        }
      );

      const nextActive = activate;

      setCustomers((previous) =>
        previous.map((item) =>
          item.id === customer.id
            ? {
                ...item,
                is_active: nextActive,
              }
            : item
        )
      );

      setSelected((previous) =>
        previous?.id === customer.id
          ? {
              ...previous,
              is_active: nextActive,
            }
          : previous
      );

      setNotice(
        `Customer ${
          activate ? "activated" : "deactivated"
        } successfully.`
      );

      setConfirmCustomer(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const confirmingActivation =
    confirmCustomer
      ? !customerActive(confirmCustomer)
      : false;

  return (
    <main className="admin-users-page">
      {/* HEADER */}

      <header className="admin-users-hero">
        <div>
          <span className="admin-users-eyebrow">
            <ShieldCheck size={15} />
            MEALMATE ADMIN
          </span>

          <h1>
            Customer Management <span>✦</span>
          </h1>

          <p>
            View customer accounts, search records,
            and manage account access.
          </p>
        </div>

        <button
          className="admin-users-refresh"
          onClick={() =>
            setRefreshKey((n) => n + 1)
          }
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={
              loading ? "admin-users-spin" : ""
            }
          />
          Refresh
        </button>
      </header>

      {/* ALERTS */}

      {error && (
        <div
          className="admin-users-alert error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="admin-users-alert success"
          role="status"
        >
          {notice}
        </div>
      )}

      {/* STATISTICS */}

      <div className="admin-users-stats">
        <div className="admin-users-stat">
          <Users size={23} />
          <div>
            <span>Total Customers</span>
            <strong>{customers.length}</strong>
          </div>
        </div>

        <div className="admin-users-stat">
          <UserCheck size={23} />
          <div>
            <span>Active Customers</span>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="admin-users-stat">
          <UserX size={23} />
          <div>
            <span>Inactive Customers</span>
            <strong>
              {customers.length - activeCount}
            </strong>
          </div>
        </div>
      </div>

      {/* CUSTOMER TABLE */}

      <section className="admin-users-panel">
        <div className="admin-users-panel-head">
          <h2>All Customers</h2>
          <span>{filtered.length} records</span>
        </div>

        <div className="admin-users-controls">
          <label className="admin-users-search">
            <Search size={18} />

            <input
              aria-label="Search customers"
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search by name, email or ID"
            />
          </label>

          <select
            aria-label="Filter customer status"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value)
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="admin-users-empty"
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="admin-users-empty"
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="admin-users-person">
                        <span className="admin-users-avatar">
                          {(
                            customer.full_name || "C"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <div>
                          <strong>
                            {customer.full_name ||
                              "Unnamed Customer"}
                          </strong>

                          <small>
                            ID #{customer.id}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      {customer.email || "—"}
                    </td>

                    <td>
                      {readableDate(
                        customer.created_at
                      )}
                    </td>

                    <td>
                      <span
                        className={`admin-users-status ${
                          customerActive(customer)
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {customerActive(customer)
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="admin-users-actions">
                        <button
                          type="button"
                          className="admin-users-view"
                          onClick={() =>
                            viewCustomer(customer)
                          }
                        >
                          <Eye size={15} />
                          View
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId !== null
                          }
                          className={
                            customerActive(customer)
                              ? "admin-users-deactivate"
                              : "admin-users-activate"
                          }
                          onClick={() =>
                            openStatusConfirmation(
                              customer
                            )
                          }
                        >
                          {busyId === customer.id
                            ? "Saving..."
                            : customerActive(customer)
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CUSTOMER DETAILS MODAL */}

      {selected && (
        <div
          className="admin-users-modal-backdrop"
          onClick={() => {
            if (!confirmCustomer) {
              setSelected(null);
            }
          }}
        >
          <section
            className="admin-users-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Customer details"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="admin-users-modal-head">
              <h2>Customer Details</h2>

              <button
                type="button"
                aria-label="Close details"
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            {detailsLoading ? (
              <p>Loading details...</p>
            ) : (
              <>
                <div className="admin-users-detail-person">
                  <span className="admin-users-avatar large">
                    {(
                      selected.full_name || "C"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <div>
                    <h3>
                      {selected.full_name ||
                        "Unnamed Customer"}
                    </h3>

                    <span
                      className={`admin-users-status ${
                        customerActive(selected)
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {customerActive(selected)
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="admin-users-detail-row">
                  <span>Customer ID</span>
                  <strong>
                    #{selected.id}
                  </strong>
                </div>

                <div className="admin-users-detail-row">
                  <span>
                    <Mail size={15} />
                    Email
                  </span>

                  <strong>
                    {selected.email || "—"}
                  </strong>
                </div>

                <div className="admin-users-detail-row">
                  <span>
                    <CalendarDays size={15} />
                    Joined
                  </span>

                  <strong>
                    {readableDate(
                      selected.created_at
                    )}
                  </strong>
                </div>

                <button
                  className={`admin-users-modal-action ${
                    customerActive(selected)
                      ? "danger"
                      : ""
                  }`}
                  disabled={
                    busyId !== null
                  }
                  onClick={() =>
                    openStatusConfirmation(
                      selected
                    )
                  }
                >
                  {busyId === selected.id
                    ? "Saving..."
                    : customerActive(selected)
                    ? "Deactivate Customer"
                    : "Activate Customer"}
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}

      {confirmCustomer && (
        <div
          className="mm-confirm-backdrop"
          onClick={
            closeStatusConfirmation
          }
        >
          <section
            className="mm-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mm-confirm-title"
            aria-describedby="mm-confirm-description"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              type="button"
              className="mm-confirm-close"
              aria-label="Close confirmation"
              disabled={busyId !== null}
              onClick={
                closeStatusConfirmation
              }
            >
              <X size={20} />
            </button>

            <div
              className={`mm-confirm-icon ${
                confirmingActivation
                  ? "activate"
                  : "deactivate"
              }`}
            >
              {confirmingActivation ? (
                <CheckCircle2 size={30} />
              ) : (
                <AlertTriangle size={30} />
              )}
            </div>

            <h2 id="mm-confirm-title">
              {confirmingActivation
                ? "Activate Customer?"
                : "Deactivate Customer?"}
            </h2>

            <p id="mm-confirm-description">
              Are you sure you want to{" "}
              <strong>
                {confirmingActivation
                  ? "activate"
                  : "deactivate"}
              </strong>{" "}
              this customer account?
            </p>

            <div className="mm-confirm-customer">
              <span className="mm-confirm-avatar">
                {(
                  confirmCustomer.full_name ||
                  "C"
                )
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <div>
                <strong>
                  {confirmCustomer.full_name ||
                    "Unnamed Customer"}
                </strong>

                <small>
                  {confirmCustomer.email ||
                    "No email"}
                </small>
              </div>
            </div>

            <p className="mm-confirm-note">
              {confirmingActivation
                ? "This customer will be able to access their account again."
                : "This customer will no longer be able to access their account while it is inactive."}
            </p>

            <div className="mm-confirm-actions">
              <button
                type="button"
                className="mm-confirm-cancel"
                disabled={busyId !== null}
                onClick={
                  closeStatusConfirmation
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={`mm-confirm-submit ${
                  confirmingActivation
                    ? "activate"
                    : "deactivate"
                }`}
                disabled={busyId !== null}
                onClick={
                  confirmStatusChange
                }
              >
                {busyId !== null
                  ? "Processing..."
                  : confirmingActivation
                  ? "Yes, Activate"
                  : "Yes, Deactivate"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
