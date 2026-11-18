
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import "../styles/AuthPages.css";

const API_URL = "http://127.0.0.1:8000";

const emptyForm = {
  full_name: "",
  shop_name: "",
  phone: "",
  address: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function Register() {
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState("customer");
  const [formData, setFormData] = useState(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAccountTypeChange = (type) => {
    if (loading) return;

    setAccountType(type);
    setFormData({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || success) return;

    setError("");
    setSuccess("");

    if (formData.full_name.trim().length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (!formData.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (formData.password.length > 128) {
      setError("Password must not exceed 128 characters.");
      return;
    }

    if (!/[A-Za-z]/.test(formData.password)) {
      setError("Password must contain at least one letter.");
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number.");
      return;
    }

    if (
      accountType === "shop_owner" &&
      (
        !formData.shop_name.trim() ||
        !formData.phone.trim() ||
        !formData.address.trim()
      )
    ) {
      setError("Please complete all shop details.");
      return;
    }

    setLoading(true);

    try {
      if (accountType === "customer") {
        // CUSTOMER REGISTRATION
        await registerUser({
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: "customer",
        });

        setSuccess(
          "Customer account created successfully! Redirecting to login..."
        );
      } else {
        // SHOP OWNER REGISTRATION
        // Correct MealMate Backend Port: 8001

        const response = await fetch(
          `${API_URL}/auth/shop-owner/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              full_name: formData.full_name.trim(),
              shop_name: formData.shop_name.trim(),
              phone: formData.phone.trim(),
              address: formData.address.trim(),
              email: formData.email.trim().toLowerCase(),
              password: formData.password,
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          let message = "Shop registration failed.";

          if (typeof data.detail === "string") {
            message = data.detail;
          } else if (Array.isArray(data.detail)) {
            message = data.detail
              .map((item) => item.msg || "Invalid input")
              .join(", ");
          }

          throw new Error(message);
        }

        setSuccess(
          "Shop registration submitted successfully! Your account is pending admin approval. You can log in after approval."
        );
      }

      setFormData({ ...emptyForm });

      // Redirect to login after successful registration.
      setTimeout(() => {
        navigate("/login");
      }, 2500);

    } catch (err) {
      console.error("Registration failed:", err);
      const detail = err?.response?.data?.detail;
      let message = "Registration failed. Please try again.";

      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((item) => {
          const field = Array.isArray(item?.loc) ? item.loc.slice(1).join(".") : "";
          return `${field ? field + ": " : ""}${typeof item?.msg === "string" ? item.msg : "Invalid input"}`;
        }).join("; ");
      } else if (typeof err?.message === "string") {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mm-auth-page mm-register-page">

      {/* LEFT SIDE - BRANDING + FEATURES */}
      <div className="mm-auth-visual mm-register-visual">

        <div className="mm-register-branding">
          <Link to="/" aria-label="MealMate Home">
            <img
              src="/images/mealmate-logo.png"
              alt="MealMate"
              className="mm-register-brand-logo"
            />
          </Link>

          <div className="mm-register-brand-subtitle">
            <span></span>
            <p>AI Meal Planner &amp; Grocery Assistant</p>
            <span></span>
          </div>

          <h2 className="mm-register-brand-tagline">
            Plan Smart. Eat Healthy. 🌿
          </h2>
        </div>

        <div className="mm-register-features">

          <div className="mm-register-feature">
            <span className="mm-register-feature-icon">▦</span>
            <span>
              Weekly
              <br />
              Meal Plan
            </span>
          </div>

          <div className="mm-register-feature">
            <span className="mm-register-feature-icon">♧</span>
            <span>
              Grocery
              <br />
              Basket
            </span>
          </div>

          <div className="mm-register-feature">
            <span className="mm-register-feature-icon">♡</span>
            <span>
              Nutrition
              <br />
              Insights
            </span>
          </div>

          <div className="mm-register-feature">
            <span className="mm-register-feature-icon">▤</span>
            <span>
              Budget
              <br />
              Friendly
            </span>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE - REGISTER FORM */}
      <div className="mm-auth-form-side">
        <div className="mm-auth-card">

          <h1>Create Your Account</h1>

          <p className="mm-auth-description">
            Join MealMate and start planning healthier
            meals for you and your family.
          </p>

          {/* ACCOUNT TYPE SELECTION */}
          <div
            className="mm-register-role-selection"
            role="group"
            aria-label="Choose account type"
          >

            <button
              type="button"
              className={`mm-register-role-card ${
                accountType === "customer"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleAccountTypeChange("customer")
              }
              aria-pressed={
                accountType === "customer"
              }
              disabled={loading || Boolean(success)}
            >
              <span className="mm-register-role-icon">
                👤
              </span>
              <strong>Customer</strong>
              <small>Plan healthy meals</small>
            </button>

            <button
              type="button"
              className={`mm-register-role-card ${
                accountType === "shop_owner"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleAccountTypeChange("shop_owner")
              }
              aria-pressed={
                accountType === "shop_owner"
              }
              disabled={loading || Boolean(success)}
            >
              <span className="mm-register-role-icon">
                🏪
              </span>
              <strong>Shop Owner</strong>
              <small>Become a partner</small>
            </button>

          </div>

          <h2 className="mm-register-form-heading">
            {accountType === "customer"
              ? "Customer Registration"
              : "Partner Shop Registration"}
          </h2>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="mm-error" role="alert">
              {error}
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {success && (
            <div className="mm-success" role="status">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* FULL NAME / OWNER NAME */}
            <div className="mm-form-group">
              <label htmlFor="full_name">
                {accountType === "customer"
                  ? "Full Name"
                  : "Shop Owner Name"}
              </label>

              <input
                id="full_name"
                type="text"
                name="full_name"
                placeholder="Enter your full name"
                value={formData.full_name}
                onChange={handleChange}
                minLength={2}
                maxLength={100}
                required
                disabled={Boolean(success)}
              />
            </div>

            {/* SHOP OWNER FIELDS */}
            {accountType === "shop_owner" && (
              <div className="mm-shop-details-row">

                <div className="mm-form-group">
                  <label htmlFor="shop_name">
                    Shop Name
                  </label>

                  <input
                    id="shop_name"
                    type="text"
                    name="shop_name"
                    placeholder="Enter shop name"
                    value={formData.shop_name}
                    onChange={handleChange}
                    maxLength={150}
                    required
                    disabled={Boolean(success)}
                  />
                </div>

                <div className="mm-form-group">
                  <label htmlFor="phone">
                    Phone Number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    maxLength={20}
                    required
                    disabled={Boolean(success)}
                  />
                </div>

              </div>
            )}

            {/* SHOP ADDRESS */}
            {accountType === "shop_owner" && (
              <div className="mm-form-group">
                <label htmlFor="address">
                  Shop Address
                </label>

                <textarea
                  id="address"
                  name="address"
                  placeholder="Enter your shop address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  required
                  disabled={Boolean(success)}
                />
              </div>
            )}

            {/* EMAIL */}
            <div className="mm-form-group">
              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={Boolean(success)}
              />
            </div>

            {/* PASSWORD */}
            <div className="mm-form-group">
              <label htmlFor="password">
                Password
              </label>

              <div className="mm-register-password-wrapper">
                <input
                  id="password"
                  type={
                    showPassword ? "text" : "password"
                  }
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  disabled={Boolean(success)}
                />

                <button
                  type="button"
                  className="mm-register-password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                  disabled={Boolean(success)}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="mm-form-group">
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <div className="mm-register-password-wrapper">
                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  disabled={Boolean(success)}
                />

                <button
                  type="button"
                  className="mm-register-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={showConfirmPassword}
                  disabled={Boolean(success)}
                >
                  {showConfirmPassword
                    ? "🙈"
                    : "👁️"}
                </button>
              </div>
            </div>

            {/* SHOP OWNER APPROVAL NOTE */}
            {accountType === "shop_owner" && (
              <p className="mm-shop-note">
                Your shop registration will be reviewed
                by the MealMate Admin. You can log in
                after your account is approved.
              </p>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="mm-btn mm-submit-btn"
              disabled={loading || Boolean(success)}
            >
              {loading
                ? "Creating Account..."
                : success
                ? "Registration Successful"
                : accountType === "customer"
                ? "Create Customer Account →"
                : "Submit Shop Registration →"}
            </button>

          </form>

          <p className="mm-auth-footer">
            Already have an account?{" "}
            <Link to="/login">
              Login Here
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Register;
