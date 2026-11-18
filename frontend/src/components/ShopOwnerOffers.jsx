
import React, { useEffect, useState } from "react";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import {
  getShopOffers,
  createShopOffer,
  updateShopOffer,
  deleteShopOffer,
} from "../services/api";

import "../styles/ShopOwnerDashboard.css";

const emptyForm = {
  title: "",
  offer_type: "percentage",
  amount: "",
  description: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

const normalizeOffers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.offers)) return data.offers;
  return [];
};

const getError = (error) => {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || "Invalid input")
      .join(", ");
  }

  return "Something went wrong. Please try again.";
};

function ShopOwnerOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOffers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getShopOffers();
      setOffers(normalizeOffers(response.data));
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (offer) => {
    setEditingId(offer.id);

    setForm({
      title: offer.title || "",
      offer_type: offer.offer_type || "percentage",
      amount: offer.amount ?? "",
      description: offer.description || "",
      start_date: offer.start_date
        ? String(offer.start_date).slice(0, 10)
        : "",
      end_date: offer.end_date
        ? String(offer.end_date).slice(0, 10)
        : "",
      is_active: Boolean(offer.is_active),
    });

    setError("");
    setMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.title.trim()) {
      setError("Please enter an offer title.");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setError("End date cannot be before start date.");
      return;
    }

    if (form.offer_type !== "promotion") {
      const amount = Number(form.amount);

      if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
        setError("Please enter a valid discount amount.");
        return;
      }

      if (form.offer_type === "percentage" && amount > 100) {
        setError("Percentage discount cannot exceed 100%.");
        return;
      }
    }

    const payload = {
      title: form.title.trim(),
      offer_type: form.offer_type,
      amount:
        form.offer_type === "promotion"
          ? null
          : Number(form.amount),
      description: form.description.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
    };

    try {
      setSaving(true);

      if (editingId !== null) {
        await updateShopOffer(editingId, payload);
      } else {
        await createShopOffer(payload);
      }

      const response = await getShopOffers();
      setOffers(normalizeOffers(response.data));

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      setMessage(
        editingId !== null
          ? "Offer updated successfully."
          : "Offer created successfully."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this offer?")) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");
      setMessage("");

      await deleteShopOffer(id);

      setOffers((previous) =>
        previous.filter((offer) => offer.id !== id)
      );

      setMessage("Offer deleted successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (offer) => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        title: offer.title,
        offer_type: offer.offer_type,
        amount: offer.amount ?? null,
        description: offer.description ?? null,
        start_date: offer.start_date
          ? String(offer.start_date).slice(0, 10)
          : null,
        end_date: offer.end_date
          ? String(offer.end_date).slice(0, 10)
          : null,
        is_active: !offer.is_active,
      };

      await updateShopOffer(offer.id, payload);

      setOffers((previous) =>
        previous.map((item) =>
          item.id === offer.id
            ? { ...item, is_active: !offer.is_active }
            : item
        )
      );

      setMessage("Offer status updated successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const formatOfferValue = (offer) => {
    if (offer.offer_type === "percentage") {
      return `${offer.amount}% OFF`;
    }

    if (offer.offer_type === "fixed") {
      return `Rs. ${Number(offer.amount || 0).toLocaleString("en-LK")} OFF`;
    }

    return "SPECIAL PROMOTION";
  };

  return (
    <section className="sop-card soo-section">
      <div className="soo-header">
        <div className="sop-card-heading">
          <Tag size={21} />

          <div>
            <h2>Shop Offers</h2>
            <p>
              Create and manage special offers for your partner shop.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="soo-add-btn"
          onClick={openCreateForm}
        >
          <Plus size={17} />
          Add New Offer
        </button>
      </div>

      {message && (
        <div className="soo-alert soo-success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="soo-alert soo-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form className="soo-form" onSubmit={handleSubmit}>
          <div className="soo-form-header">
            <h3>
              {editingId !== null
                ? "Edit Offer"
                : "Create New Offer"}
            </h3>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close offer form"
            >
              <X size={19} />
            </button>
          </div>

          <div className="soo-form-grid">
            <label>
              Offer Title *
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Weekend Grocery Discount"
                required
                maxLength={150}
              />
            </label>

            <label>
              Offer Type *
              <select
                name="offer_type"
                value={form.offer_type}
                onChange={handleChange}
              >
                <option value="percentage">
                  Percentage Discount
                </option>
                <option value="fixed">
                  Fixed Amount Discount
                </option>
                <option value="promotion">
                  Special Promotion
                </option>
              </select>
            </label>

            {form.offer_type !== "promotion" && (
              <label>
                {form.offer_type === "percentage"
                  ? "Discount Percentage (%) *"
                  : "Discount Amount (Rs.) *"}

                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  max={
                    form.offer_type === "percentage"
                      ? "100"
                      : undefined
                  }
                  step="0.01"
                  placeholder={
                    form.offer_type === "percentage"
                      ? "10"
                      : "250"
                  }
                  required
                />
              </label>
            )}

            <label className="soo-full">
              Offer Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe your special offer..."
              />
            </label>

            <label>
              <span>
                <CalendarDays size={15} />
                Start Date
              </span>

              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
              />
            </label>

            <label>
              <span>
                <CalendarDays size={15} />
                End Date
              </span>

              <input
                type="date"
                name="end_date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={handleChange}
              />
            </label>
          </div>

          <label className="soo-active-control">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            <span>Set this offer as active</span>
          </label>

          <div className="soo-form-actions">
            <button
              type="button"
              className="soo-cancel-btn"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="soo-save-btn"
              disabled={saving}
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Offer"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="soo-empty">
          <LoaderCircle className="sop-spin" size={25} />
          <p>Loading shop offers...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="soo-empty">
          <Tag size={32} />
          <h3>No Offers Yet</h3>
          <p>
            Add your first special offer to attract customers.
          </p>
        </div>
      ) : (
        <div className="soo-offer-list">
          {offers.map((offer) => (
            <article className="soo-offer-card" key={offer.id}>
              <div className="soo-offer-main">
                <div className="soo-offer-icon">
                  <Tag size={22} />
                </div>

                <div className="soo-offer-info">
                  <div className="soo-offer-title">
                    <h3>{offer.title}</h3>

                    <span
                      className={
                        offer.is_active
                          ? "soo-status-active"
                          : "soo-status-inactive"
                      }
                    >
                      {offer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <strong className="soo-offer-value">
                    {formatOfferValue(offer)}
                  </strong>

                  {offer.description && (
                    <p>{offer.description}</p>
                  )}

                  <div className="soo-offer-dates">
                    <CalendarDays size={14} />
                    {offer.start_date
                      ? String(offer.start_date).slice(0, 10)
                      : "No start date"}
                    {" — "}
                    {offer.end_date
                      ? String(offer.end_date).slice(0, 10)
                      : "No end date"}
                  </div>
                </div>
              </div>

              <div className="soo-offer-actions">
                <button
                  type="button"
                  className="soo-toggle-btn"
                  disabled={saving}
                  onClick={() => handleToggleStatus(offer)}
                >
                  {offer.is_active ? "Deactivate" : "Activate"}
                </button>

                <button
                  type="button"
                  className="soo-edit-btn"
                  onClick={() => openEditForm(offer)}
                >
                  <Pencil size={16} />
                  Edit
                </button>

                <button
                  type="button"
                  className="soo-delete-btn"
                  disabled={deletingId === offer.id}
                  onClick={() => handleDelete(offer.id)}
                >
                  <Trash2 size={16} />
                  {deletingId === offer.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ShopOwnerOffers;
