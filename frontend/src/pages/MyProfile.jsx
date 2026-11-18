
import React, { useEffect, useRef, useState } from "react";

import {
  UserRound,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Save,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  Trash2,
  Upload,
} from "lucide-react";

import {
  getCustomerProfile,
  updateCustomerProfile,
  uploadCustomerPhoto,
  removeCustomerPhoto,
} from "../services/api";

import "../styles/CustomerDashboard.css";

const API_BASE = "http://127.0.0.1:8000";

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  address: "",
};

const getErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;

  return typeof detail === "string"
    ? detail
    : fallback;
};

export default function MyProfile() {
  const photoInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ========================================
  // LOAD CUSTOMER PROFILE
  // ========================================

  const loadProfile = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getCustomerProfile();
      const data = response.data;

      setProfile(data);

      setForm({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
      });
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load your profile."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // ========================================
  // PERSONAL INFORMATION
  // ========================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleCancel = () => {
    setForm({
      full_name: profile?.full_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
    });

    setEditing(false);
    setError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateCustomerProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });

      const updated = response.data;

      setProfile(updated);
window.dispatchEvent(
  new CustomEvent("mealmate:profile-updated", {
    detail: updated,
  })
);
      setForm({
        full_name: updated.full_name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        address: updated.address || "",
      });

      setEditing(false);

      setSuccess(
        "Your profile was updated successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to save profile changes."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // UPLOAD / CHANGE PROFILE PHOTO
  // ========================================

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError(
        "Please select a JPG, PNG or WEBP image."
      );

      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setError(
        "Profile photo must be 2 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    setPhotoLoading(true);

    try {
      const response = await uploadCustomerPhoto(file);

      const photoPath = response.data.profile_photo;
window.dispatchEvent(
  new CustomEvent("mealmate:profile-updated", {
    detail: {
      profile_photo: photoPath,
    },
  })
);

      setProfile((previous) => ({
        ...previous,
        profile_photo: photoPath,
      }));

      setSuccess(
        "Profile photo uploaded successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to upload profile photo."
        )
      );
    } finally {
      setPhotoLoading(false);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  // ========================================
  // REMOVE PROFILE PHOTO
  // ========================================

  const handlePhotoRemove = async () => {
    setPhotoLoading(true);
    setError("");
    setSuccess("");

    try {
      await removeCustomerPhoto();
window.dispatchEvent(
  new CustomEvent("mealmate:profile-updated", {
    detail: {
      profile_photo: null,
    },
  })
);

      setProfile((previous) => ({
        ...previous,
        profile_photo: null,
      }));

      setSuccess(
        "Profile photo removed successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to remove profile photo."
        )
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  // ========================================
  // PROFILE PHOTO URL
  // ========================================

  const photoUrl = profile?.profile_photo
    ? `${API_BASE}${profile.profile_photo}`
    : null;

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="mp-loading">
        <RefreshCw
          size={27}
          className="mp-spin"
        />

        Loading your profile...
      </div>
    );
  }

  // ========================================
  // PAGE UI
  // ========================================

  return (
    <div className="mp-page">

      {/* PAGE HEADING */}
      <div className="mp-heading">
        <div>
          <span className="mp-eyebrow">
            MY MEALMATE ACCOUNT
          </span>

          <h1>
            My <em>Profile</em>
          </h1>

          <p>
            Manage your personal details and account
            information.
          </p>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div
          className="mp-alert mp-error"
          role="alert"
        >
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {success && (
        <div
          className="mp-alert mp-success"
          role="status"
        >
          <CheckCircle2 size={19} />
          <span>{success}</span>
        </div>
      )}

      <div className="mp-layout">

        {/* ==================================
            LEFT PROFILE CARD
        ================================== */}

        <aside className="mp-profile-card">

          <div className="mp-profile-cover" />

          {/* PROFILE PHOTO */}
          <div className="mp-photo-section">

            <div className="mp-profile-avatar">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Customer Profile"
                  className="mp-avatar-image"
                />
              ) : (
                <UserRound size={44} />
              )}

              <button
                type="button"
                className="mp-avatar-camera"
                onClick={() =>
                  photoInputRef.current?.click()
                }
                disabled={photoLoading}
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                <Camera size={16} />
              </button>
            </div>

            {/* HIDDEN FILE INPUT */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
            />

            {/* PHOTO BUTTONS */}
            <div className="mp-photo-actions">

              <button
                type="button"
                className="mp-upload-btn"
                disabled={photoLoading}
                onClick={() =>
                  photoInputRef.current?.click()
                }
              >
                {photoLoading ? (
                  <>
                    <RefreshCw
                      size={15}
                      className="mp-spin"
                    />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    {photoUrl
                      ? "Change Photo"
                      : "Upload Photo"}
                  </>
                )}
              </button>

              {photoUrl && (
                <button
                  type="button"
                  className="mp-remove-btn"
                  disabled={photoLoading}
                  onClick={handlePhotoRemove}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              )}

            </div>

            <small className="mp-photo-hint">
              JPG, PNG or WEBP • Max 2 MB
            </small>

          </div>

          {/* CUSTOMER INFORMATION */}
          <h2>
            {profile?.full_name || "Customer"}
          </h2>

          <p>{profile?.email}</p>

          <span className="mp-role">
            <ShieldCheck size={15} />
            MealMate Customer
          </span>

          <div className="mp-profile-divider" />

          <div className="mp-profile-note">
            <span>🌿</span>

            <strong>
              Plan Smart. Eat Healthy.
            </strong>

            <p>
              Your personalized healthy meal planning
              journey starts here.
            </p>
          </div>

        </aside>

        {/* ==================================
            RIGHT PERSONAL INFORMATION CARD
        ================================== */}

        <section className="mp-details-card">

          <div className="mp-card-heading">
            <div>
              <h2>Personal Information</h2>

              <p>
                Keep your account information up to date.
              </p>
            </div>

            {!editing && (
              <button
                type="button"
                className="mp-edit-btn"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
              >
                <Pencil size={16} />
                Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleSave}>
            <div className="mp-fields">

              {/* FULL NAME */}
              <label className="mp-field">
                <span>
                  <UserRound size={16} />
                  Full Name
                </span>

                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  disabled={!editing}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>

              {/* EMAIL */}
              <label className="mp-field">
                <span>
                  <Mail size={16} />
                  Email Address
                </span>

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={!editing}
                  required
                />
              </label>

              {/* PHONE */}
              <label className="mp-field">
                <span>
                  <Phone size={16} />
                  Phone Number
                </span>

                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Enter phone number"
                  maxLength={20}
                />
              </label>

              {/* ADDRESS */}
              <label className="mp-field mp-field-full">
                <span>
                  <MapPin size={16} />
                  Address
                </span>

                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Enter your address"
                  rows={3}
                  maxLength={255}
                />
              </label>

            </div>

            {/* SAVE / CANCEL BUTTONS */}
            {editing && (
              <div className="mp-actions">

                <button
                  type="button"
                  className="mp-cancel-btn"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X size={17} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mp-save-btn"
                  disabled={saving}
                >
                  <Save size={17} />
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>
            )}
          </form>

        </section>
      </div>
    </div>
  );
}
