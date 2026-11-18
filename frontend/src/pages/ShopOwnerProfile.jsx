
import React, { useEffect, useState } from "react";
import {
  Store,
  UserRound,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Trash2,
} from "lucide-react";

import {
  getShopOwnerProfile,
  updateShopOwnerProfile,
  uploadShopOwnerImage,
  removeShopOwnerImage,
} from "../services/api";

import ShopOwnerLayout from "../components/ShopOwnerLayout";
import ShopOwnerOffers from "../components/ShopOwnerOffers";
import ShopOwnerHighlights from "../components/ShopOwnerHighlights";
import "../styles/ShopOwnerDashboard.css";

const API_URL = "http://127.0.0.1:8000";

const initialForm = {
  full_name: "",
  email: "",
  shop_name: "",
  phone: "",
  address: "",
  shop_description: "",
  opening_hours: "",
};

function ShopOwnerProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =========================================
  // NOTIFY SHOP OWNER NAVBAR
  // =========================================

  const notifyNavbar = () => {
    window.dispatchEvent(
      new Event("mealmate:shop-profile-updated")
    );
  };

  // =========================================
  // LOAD SHOP OWNER PROFILE
  // =========================================

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getShopOwnerProfile();
      const data = response.data;

      setProfile(data);

      setForm({
        full_name: data.full_name || "",
        email: data.email || "",
        shop_name: data.shop_name || "",
        phone: data.phone || "",
        address: data.address || "",
        shop_description: data.shop_description || "",
        opening_hours: data.opening_hours || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load shop profile."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // =========================================
  // HANDLE FORM CHANGE
  // =========================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =========================================
  // SAVE PROFILE
  // =========================================

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await updateShopOwnerProfile(form);
      await loadProfile();

      notifyNavbar();

      setMessage("Shop profile updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to save shop profile."
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // UPLOAD PROFILE / LOGO / COVER IMAGE
  // =========================================

  const handleImageUpload = async (type, file) => {
    if (!file) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError("Please select a JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must not exceed 2 MB.");
      return;
    }

    try {
      setUploading(type);
      setError("");
      setMessage("");

      await uploadShopOwnerImage(type, file);
      await loadProfile();

      notifyNavbar();

      setMessage("Image uploaded successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Image upload failed."
      );
    } finally {
      setUploading("");
    }
  };

  // =========================================
  // DELETE IMAGE
  // =========================================

  const handleImageDelete = async (type) => {
    if (!window.confirm("Remove this image?")) return;

    try {
      setUploading(type);
      setError("");
      setMessage("");

      await removeShopOwnerImage(type);
      await loadProfile();

      notifyNavbar();

      setMessage("Image removed successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to remove image."
      );
    } finally {
      setUploading("");
    }
  };

  // =========================================
  // IMAGE URL
  // =========================================

  const imageUrl = (path) => {
    if (!path) return null;

    if (path.startsWith("http")) return path;

    return `${API_URL}${path}`;
  };

  // =========================================
  // IMAGE EDITOR
  // =========================================

  const renderImageEditor = (title, type, field) => {
    const image = imageUrl(profile?.[field]);

    return (
      <div className="sop-image-editor">
        <h3>{title}</h3>

        <div
          className={`sop-image-preview sop-image-${type}`}
        >
          {image ? (
            <img src={image} alt={title} />
          ) : type === "photo" ? (
            <UserRound size={34} />
          ) : (
            <Store size={34} />
          )}
        </div>

        <div className="sop-image-actions">
          <label className="sop-upload-button">
            <Camera size={16} />

            {uploading === type
              ? "Uploading..."
              : "Upload"}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={Boolean(uploading)}
              onChange={(event) => {
                const file = event.target.files?.[0];

                handleImageUpload(type, file);

                event.target.value = "";
              }}
              hidden
            />
          </label>

          {image && (
            <button
              type="button"
              className="sop-remove-button"
              disabled={Boolean(uploading)}
              onClick={() => handleImageDelete(type)}
            >
              <Trash2 size={16} />
              Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  // =========================================
  // LOADING
  // =========================================

  if (loading && !profile) {
    return (
      <div className="sop-loading">
        <LoaderCircle
          className="sop-spin"
          size={28}
        />
        Loading shop profile...
      </div>
    );
  }

  // =========================================
  // MAIN PROFILE PAGE
  // =========================================

  return (
    <ShopOwnerLayout
      title=""
      profile={profile}
    >
      <div className="sop-page">
        <div className="sop-container">

          {/* ===================================
              PROFILE HEADER
          =================================== */}

          <header className="sop-header">
            <div className="sop-heading">
              <span>MEALMATE PARTNER PORTAL</span>

              <h1>My Shop 🏘️</h1>

              <p>
                Manage your personal details,
                shop information, photos and branding.
              </p>
            </div>

            {profile?.approval_status === "approved" && (
              <span className="sop-approved">
                <CheckCircle2 size={16} />
                Approved Partner
              </span>
            )}
          </header>

          {/* ===================================
              SUCCESS MESSAGE
          =================================== */}

          {message && (
            <div className="sop-message sop-success">
              <CheckCircle2 size={19} />
              {message}
            </div>
          )}

          {/* ===================================
              ERROR MESSAGE
          =================================== */}

          {error && (
            <div className="sop-message sop-error">
              <AlertCircle size={19} />
              {error}
            </div>
          )}

          {/* ===================================
              SHOP IMAGES
          =================================== */}

          <section className="sop-card">
            <div className="sop-card-heading">
              <Camera size={20} />

              <div>
                <h2>Shop Images</h2>

                <p>
                  Upload your profile photo, shop logo
                  and cover. JPG, PNG or WEBP —
                  maximum 2 MB.
                </p>
              </div>
            </div>

            <div className="sop-images-grid">
              {renderImageEditor(
                "Owner Profile Photo",
                "photo",
                "profile_photo"
              )}

              {renderImageEditor(
                "Shop Logo",
                "logo",
                "shop_logo"
              )}

              {renderImageEditor(
                "Shop Cover Photo",
                "cover",
                "shop_cover_photo"
              )}
            </div>
          </section>

          {/* ===================================
              PROFILE FORM
          =================================== */}

          <form onSubmit={handleSave}>

            {/* OWNER INFORMATION */}

            <section className="sop-card">
              <div className="sop-card-heading">
                <UserRound size={20} />

                <div>
                  <h2>Owner Information</h2>

                  <p>
                    Update your personal contact details.
                  </p>
                </div>
              </div>

              <div className="sop-form-grid">
                <label>
                  Full Name *

                  <input
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Email Address *

                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>
            </section>

            {/* SHOP INFORMATION */}

            <section className="sop-card">
              <div className="sop-card-heading">
                <Store size={20} />

                <div>
                  <h2>Shop Information</h2>

                  <p>
                    These details help customers
                    learn about your partner shop.
                  </p>
                </div>
              </div>

              <div className="sop-form-grid">
                <label>
                  Shop Name *

                  <input
                    name="shop_name"
                    value={form.shop_name}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Phone Number

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </label>

                <label className="sop-full">
                  Shop Address

                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                  />
                </label>

                <label className="sop-full">
                  Shop Description

                  <textarea
                    name="shop_description"
                    value={form.shop_description}
                    onChange={handleChange}
                    maxLength={1000}
                    rows={4}
                    placeholder="Tell customers about your shop..."
                  />
                </label>

                <label className="sop-full">
                  Opening Hours

                  <input
                    name="opening_hours"
                    value={form.opening_hours}
                    onChange={handleChange}
                    placeholder="Mon–Sat: 8:00 AM – 7:00 PM"
                  />
                </label>
              </div>
            </section>

            {/* SAVE PROFILE BUTTON */}

            <div className="sop-save-bar">
              <button
                type="submit"
                className="sop-save-button"
                disabled={saving}
              >
                <Save size={18} />

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>

          {/* ===================================
              SHOP OFFERS SECTION
          =================================== */}

          <ShopOwnerOffers />
          <ShopOwnerHighlights />
        </div>
      </div>
    </ShopOwnerLayout>
  );
}

export default ShopOwnerProfile;
