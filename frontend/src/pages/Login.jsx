
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, getMyProfile } from "../services/api";
import "../styles/AuthPages.css";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ========================================
  // HANDLE INPUT CHANGES
  // ========================================

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    if (error) {
      setError("");
    }
  };

  // ========================================
  // HANDLE LOGIN
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      // STEP 1: LOGIN WITH FASTAPI
      const response = await loginUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      const token = response.data?.access_token;

      if (!token) {
        throw new Error(
          "Access token not received from backend."
        );
      }

      // STEP 2: SAVE JWT TOKEN
      localStorage.setItem("mealmate_token", token);

      localStorage.removeItem("access_token");
      localStorage.removeItem("token");

      // STEP 3: GET LOGGED-IN USER
      const userResponse = await getMyProfile();
      const userData = userResponse.data;

      if (!userData || !userData.role) {
        throw new Error(
          "Unable to verify user account."
        );
      }

      // STEP 4: ROLE-BASED NAVIGATION

      if (userData.role === "customer") {
        navigate("/customer/dashboard", {
          replace: true,
        });
        return;
      }

      if (userData.role === "shop_owner") {
        // SHOP OWNER APPROVAL CHECK
        const approvalStatus = (
          userData.approval_status || ""
        ).toLowerCase();

        if (approvalStatus === "pending") {
          throw new Error(
            "Your shop registration is pending admin approval. Please wait until the MealMate Admin approves your account."
          );
        }

        if (approvalStatus === "rejected") {
          throw new Error(
            "Your shop registration has been rejected. Please contact the MealMate Admin."
          );
        }

        if (approvalStatus !== "approved") {
          throw new Error(
            "Your shop account is not approved yet. Please contact the MealMate Admin."
          );
        }

        navigate("/shop-owner/dashboard", {
          replace: true,
        });
        return;
      }

      if (userData.role === "admin") {
        navigate("/admin/dashboard", {
          replace: true,
        });
        return;
      }

      throw new Error(
        "Invalid account role. Please contact support."
      );

    } catch (err) {
      // REMOVE TOKEN AFTER FAILED LOGIN
      localStorage.removeItem("mealmate_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");

      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // INVALID EMAIL OR PASSWORD
      if (status === 401) {
        setError(
          typeof detail === "string"
            ? detail
            : "Invalid email or password. Please try again."
        );
      }

      // ACCOUNT NOT APPROVED / INACTIVE
      else if (status === 403) {
        if (
          typeof detail === "string" &&
          detail.toLowerCase().includes("approval")
        ) {
          setError(
            "Your shop account is not approved yet. Please wait for admin approval. If you have already submitted your registration, contact the MealMate Admin."
          );
        } else {
          setError(
            typeof detail === "string"
              ? detail
              : "Your account is not authorized to log in."
          );
        }
      }

      // NETWORK / SERVER ERRORS
      else if (!err.response && err.request) {
        setError(
          "Cannot connect to the MealMate server. Please check that the backend is running."
        );
      }

      // OTHER ERRORS
      else {
        setError(
          typeof detail === "string"
            ? detail
            : err.message ||
                "Login failed. Please try again."
        );
      }

      console.error("Login failed:", {
        status,
        detail,
        message: err.message,
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mm-auth-page mm-login-page">

      {/* LEFT SIDE - BRANDING + FEATURES */}
      <div className="mm-auth-visual mm-login-visual">

        {/* TOP BRANDING */}
        <div className="mm-login-branding">

          <img
            src="/images/mealmate-logo.png"
            alt="MealMate"
            className="mm-login-brand-logo"
          />

          <div className="mm-login-brand-subtitle">
            <span></span>
            <p>AI Meal Planner &amp; Grocery Assistant</p>
            <span></span>
          </div>

          <h2 className="mm-login-brand-tagline">
            Plan Smart. Eat Healthy.
            <span className="mm-login-brand-leaf">
              {" "}🌿
            </span>
          </h2>

        </div>

        {/* BOTTOM FEATURES */}
        <div className="mm-login-features">

          <div className="mm-login-feature">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
              />
              <path d="M7 3v4M17 3v4M3 10h18" />
              <path d="M8 14h2M14 14h2M8 18h2" />
            </svg>

            <span>
              Weekly<br />Meal Plan
            </span>
          </div>

          <div className="mm-login-feature">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h16l-2 10H6L4 10Z" />
              <path d="m8 10 4-7 4 7M9 13v4M15 13v4" />
            </svg>

            <span>
              Grocery<br />Basket
            </span>
          </div>

          <div className="mm-login-feature">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.8 8.6c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a5 5 0 0 1 8.8-3.1 5 5 0 0 1 8.8 3.1Z" />
              <path d="M5 12h4l2-3 2 6 2-3h4" />
            </svg>

            <span>
              Nutrition<br />Insights
            </span>
          </div>

          <div className="mm-login-feature">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse
                cx="12"
                cy="6"
                rx="7"
                ry="3"
              />
              <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
              <path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
            </svg>

            <span>
              Budget<br />Friendly
            </span>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="mm-auth-form-side">
        <div className="mm-auth-card">

          <h1>Welcome Back!</h1>

          <p className="mm-auth-description">
            Login to continue your healthy meal
            planning journey.
          </p>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="mm-error" role="alert">
              {error}
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit}>

            {/* EMAIL */}
            <div className="mm-form-group">
              <label htmlFor="login-email">
                Email Address
              </label>

              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="mm-form-group">
              <label htmlFor="login-password">
                Password
              </label>

              <div className="mm-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="mm-password-toggle"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              className="mm-btn mm-submit-btn"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login →"}
            </button>

          </form>

          {/* GOOGLE LOGIN SECTION */}
          <div className="mm-google-login-section">

            <div className="mm-login-divider">
              <span>or continue with</span>
            </div>

            <button
              type="button"
              className="mm-google-login-btn"
              onClick={() => {
                setError(
                  "Google Sign-In is not configured yet."
                );
              }}
            >
              <svg
                className="mm-google-icon"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 24 46.98 24.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>

              <span>Continue with Google</span>
            </button>

          </div>

          {/* REGISTER LINK */}
          <p className="mm-auth-footer">
            Don't have an account?{" "}
            <Link to="/register">
              Create Account
            </Link>
          </p>

          {/* BACK TO HOME */}
          <p className="mm-auth-footer">
            <Link to="/">
              ← Back to Home
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Login;
