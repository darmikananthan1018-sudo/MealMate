

import React, { useEffect, useState } from "react";

import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import {
  getShopHighlights,
  createShopHighlight,
  updateShopHighlight,
  deleteShopHighlight,
} from "../services/api";

import "../styles/ShopOwnerDashboard.css";

// ==========================================
// PREDEFINED HIGHLIGHTS
// ==========================================

const PRESET_HIGHLIGHTS = [
  "Fresh Grocery Selection",
  "Budget-Friendly Prices",
  "Locally Sourced Products",
  "Vegetarian-Friendly Options",
  "Flexible Pickup Hours",
  "Quick Basket Confirmation",
];

// ==========================================
// NORMALIZE API RESPONSE
// ==========================================

const normalizeHighlights = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.highlights)) {
    return data.highlights;
  }

  return [];
};

// ==========================================
// ERROR MESSAGE HELPER
// ==========================================

const getError = (error) => {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || "Invalid input")
      .join(", ");
  }

  return "Something went wrong. Please try again.";
};

// ==========================================
// MAIN COMPONENT
// ==========================================

function ShopOwnerHighlights() {
  const [highlights, setHighlights] = useState([]);

  const [customTitle, setCustomTitle] = useState("");

  const [loading, setLoading] = useState(true);

  const [busyKey, setBusyKey] = useState(null);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  // ==========================================
  // LOAD HIGHLIGHTS FROM DATABASE
  // ==========================================

  const loadHighlights = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getShopHighlights();

      setHighlights(
        normalizeHighlights(response.data)
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHighlights();
  }, []);

  // ==========================================
  // FIND EXISTING HIGHLIGHT
  // ==========================================

  const findHighlight = (title) => {
    return highlights.find(
      (item) =>
        String(item.title || "")
          .trim()
          .toLowerCase() ===
        title.trim().toLowerCase()
    );
  };

  // ==========================================
  // SELECT / UNSELECT PRESET HIGHLIGHT
  // ==========================================

  const togglePreset = async (title) => {
    const existing = findHighlight(title);

    try {
      setBusyKey(title);
      setError("");
      setMessage("");

      if (existing) {
        // Existing preset: update selection status

        await updateShopHighlight(existing.id, {
          is_selected: !existing.is_selected,
        });
      } else {
        // New preset: is_custom MUST be false

        await createShopHighlight({
          title: title,
          is_custom: false,
          is_selected: true,
        });
      }

      const response = await getShopHighlights();

      setHighlights(
        normalizeHighlights(response.data)
      );

      setMessage(
        existing
          ? existing.is_selected
            ? "Highlight unselected successfully."
            : "Highlight selected successfully."
          : "Highlight selected successfully."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusyKey(null);
    }
  };

  // ==========================================
  // SELECT / UNSELECT CUSTOM HIGHLIGHT
  // ==========================================

  const toggleCustom = async (highlight) => {
    try {
      setBusyKey(highlight.id);
      setError("");
      setMessage("");

      await updateShopHighlight(highlight.id, {
        is_selected: !highlight.is_selected,
      });

      setHighlights((previous) =>
        previous.map((item) =>
          item.id === highlight.id
            ? {
                ...item,
                is_selected: !item.is_selected,
              }
            : item
        )
      );

      setMessage(
        highlight.is_selected
          ? "Highlight unselected successfully."
          : "Highlight selected successfully."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusyKey(null);
    }
  };

  // ==========================================
  // ADD CUSTOM HIGHLIGHT
  // ==========================================

  const addCustomHighlight = async (event) => {
    event.preventDefault();

    const title = customTitle
      .trim()
      .replace(/\s+/g, " ");

    setError("");
    setMessage("");

    if (!title) {
      setError("Please enter a highlight.");
      return;
    }

    if (title.length < 2) {
      setError(
        "Highlight must contain at least 2 characters."
      );
      return;
    }

    if (title.length > 60) {
      setError(
        "Highlight cannot exceed 60 characters."
      );
      return;
    }

    const isPreset = PRESET_HIGHLIGHTS.some(
      (preset) =>
        preset.toLowerCase() ===
        title.toLowerCase()
    );

    if (isPreset) {
      setError(
        "This highlight already exists in Recommended Highlights."
      );
      return;
    }

    if (findHighlight(title)) {
      setError("This highlight already exists.");
      return;
    }

    try {
      setBusyKey("new");
      setError("");
      setMessage("");

      // IMPORTANT FIX:
      // Custom highlight requires is_custom: true

      await createShopHighlight({
        title: title,
        is_custom: true,
        is_selected: true,
      });

      const response = await getShopHighlights();

      setHighlights(
        normalizeHighlights(response.data)
      );

      setCustomTitle("");

      setMessage(
        "Custom highlight added successfully."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusyKey(null);
    }
  };

  // ==========================================
  // DELETE CUSTOM HIGHLIGHT
  // ==========================================

  const deleteCustomHighlight = async (highlight) => {
    if (!highlight.is_custom) {
      setError(
        "Preset highlights cannot be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${highlight.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyKey(highlight.id);
      setError("");
      setMessage("");

      await deleteShopHighlight(highlight.id);

      setHighlights((previous) =>
        previous.filter(
          (item) => item.id !== highlight.id
        )
      );

      setMessage(
        "Custom highlight deleted successfully."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusyKey(null);
    }
  };

  // ==========================================
  // CUSTOM HIGHLIGHTS
  // ==========================================

  const customHighlights = highlights.filter(
    (item) => item.is_custom === true
  );

  // ==========================================
  // SELECTED COUNT
  // ==========================================

  const selectedCount = highlights.filter(
    (item) => item.is_selected === true
  ).length;

  // ==========================================
  // UI
  // ==========================================

  return (
    <section className="sop-card soh-section">

      {/* SECTION HEADER */}

      <div className="sop-card-heading">
        <Sparkles size={21} />

        <div>
          <h2>Shop Highlights</h2>

          <p>
            Select what makes your shop special.
            Customers will be able to see your
            selected highlights.
          </p>
        </div>
      </div>

      {/* SELECTED COUNT */}

      <div className="soh-count">
        {selectedCount} highlight
        {selectedCount !== 1 ? "s" : ""} selected
      </div>

      {/* SUCCESS MESSAGE */}

      {message && (
        <div className="soh-alert soh-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && (
        <div className="soh-alert soh-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="soh-loading">
          <LoaderCircle
            className="sop-spin"
            size={25}
          />

          <span>Loading highlights...</span>
        </div>
      ) : (
        <>

          {/* ===============================
              RECOMMENDED HIGHLIGHTS
          =============================== */}

          <h3 className="soh-subtitle">
            Recommended Highlights
          </h3>

          <div className="soh-grid">
            {PRESET_HIGHLIGHTS.map((title) => {
              const existing = findHighlight(title);

              const selected = Boolean(
                existing?.is_selected
              );

              return (
                <button
                  key={title}
                  type="button"
                  className={`soh-option ${
                    selected
                      ? "soh-selected"
                      : ""
                  }`}
                  disabled={busyKey !== null}
                  onClick={() =>
                    togglePreset(title)
                  }
                  aria-pressed={selected}
                >
                  <span className="soh-option-icon">
                    {selected ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <Plus size={19} />
                    )}
                  </span>

                  <span>{title}</span>
                </button>
              );
            })}
          </div>

          {/* ===============================
              CUSTOM HIGHLIGHTS
          =============================== */}

          <div className="soh-custom-section">
            <h3 className="soh-subtitle">
              Custom Highlights
            </h3>

            <p className="soh-description">
              Add a unique feature about your shop.
            </p>

            {/* ADD CUSTOM HIGHLIGHT */}

            <form
              className="soh-add-form"
              onSubmit={addCustomHighlight}
            >
              <input
                type="text"
                value={customTitle}
                onChange={(event) =>
                  setCustomTitle(event.target.value)
                }
                placeholder="e.g. Family-Owned Local Shop"
                minLength={2}
                maxLength={60}
                disabled={busyKey !== null}
              />

              <button
                type="submit"
                disabled={busyKey !== null}
              >
                {busyKey === "new" ? (
                  <LoaderCircle
                    className="sop-spin"
                    size={17}
                  />
                ) : (
                  <Plus size={17} />
                )}

                {busyKey === "new"
                  ? "Adding..."
                  : "Add Highlight"}
              </button>
            </form>

            {/* CUSTOM HIGHLIGHT LIST */}

            {customHighlights.length > 0 && (
              <div className="soh-custom-list">
                {customHighlights.map(
                  (highlight) => (
                    <div
                      className="soh-custom-item"
                      key={highlight.id}
                    >
                      {/* SELECT / UNSELECT */}

                      <button
                        type="button"
                        className={`soh-custom-toggle ${
                          highlight.is_selected
                            ? "soh-selected"
                            : ""
                        }`}
                        disabled={busyKey !== null}
                        onClick={() =>
                          toggleCustom(highlight)
                        }
                        aria-pressed={
                          Boolean(
                            highlight.is_selected
                          )
                        }
                      >
                        {highlight.is_selected ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Plus size={18} />
                        )}

                        <span>
                          {highlight.title}
                        </span>
                      </button>

                      {/* DELETE */}

                      <button
                        type="button"
                        className="soh-delete"
                        disabled={busyKey !== null}
                        onClick={() =>
                          deleteCustomHighlight(
                            highlight
                          )
                        }
                        aria-label={`Delete ${highlight.title}`}
                      >
                        {busyKey === highlight.id ? (
                          <LoaderCircle
                            className="sop-spin"
                            size={17}
                          />
                        ) : (
                          <Trash2 size={17} />
                        )}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

          </div>
        </>
      )}
    </section>
  );
}

export default ShopOwnerHighlights;
