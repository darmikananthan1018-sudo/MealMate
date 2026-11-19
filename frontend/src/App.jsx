
import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { getMyProfile } from "./services/api";

// ========================================
// PUBLIC PAGES
// ========================================

import LandingPage from "./pages/LandingPage";
import Register from "./pages/Register";
import Login from "./pages/Login";

// ========================================
// CUSTOMER LAYOUT
// ========================================

import CustomerLayout from "./components/CustomerLayout";

// ========================================
// CUSTOMER PAGES
// ========================================

import CustomerDashboard from "./pages/CustomerDashboard";
import FoodPreferences from "./pages/FoodPreferences";
import MealPlan from "./pages/MealPlan";
import WeeklyGroceryBasket from "./pages/WeeklyGroceryBasket";
import ChoosePartnerShop from "./pages/ChoosePartnerShop";
import MyOrders from "./pages/MyOrders";
import MyProfile from "./pages/MyProfile";
import CustomerNotifications from "./pages/CustomerNotifications";
import PremiumPlans from "./pages/PremiumPlans";
// ========================================
// SHOP OWNER PAGES
// ========================================

import ShopOwnerDashboard from "./pages/ShopOwnerDashboard";
import ShopOwnerBasketDetails from "./pages/ShopOwnerBasketDetails";
import ShopOwnerProfile from "./pages/ShopOwnerProfile";
import ShopOwnerNotifications from "./pages/ShopOwnerNotifications";
import ShopOwnerReceivedOrders from "./pages/ShopOwnerReceivedOrders";
import ShopOwnerSubscription from "./pages/ShopOwnerSubscription";
// ========================================
// ADMIN PAGES
// ========================================

import AdminDashboard from "./pages/AdminDashboard";
import AdminLayout from "./components/AdminLayout";
import AdminCustomer from "./pages/AdminCustomer";
import AdminShopOwners from "./pages/AdminShopOwners";
import AdminOrders from "./pages/AdminOrders";
import AdminReports from "./pages/AdminReports";
import AdminNotifications from "./pages/AdminNotifications";
// ========================================
// ROLE DASHBOARD PATHS
// ========================================

const dashboardPaths = {
  customer: "/customer/dashboard",
  shop_owner: "/shop-owner/dashboard",
  admin: "/admin/dashboard",
};

// ========================================
// AUTH HELPERS
// ========================================

const getStoredToken = () => {
  return (
    localStorage.getItem("mealmate_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
};

const clearStoredTokens = () => {
  localStorage.removeItem("mealmate_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
};

// ========================================
// PROTECTED ROUTES
// ========================================

function ProtectedRoute({ allowedRole }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const verifyUser = async () => {
      const token = getStoredToken();

      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await getMyProfile();

        if (active) {
          setUser(response.data);
        }
      } catch (error) {
        console.error("Authentication error:", {
          status: error.response?.status,
          detail: error.response?.data?.detail,
        });

        if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          clearStoredTokens();
        }

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    verifyUser();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Poppins, sans-serif",
          color: "#5030a0",
        }}
      >
        Verifying your MealMate account...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Shop Owner Approval Validation
  if (
    user.role === "shop_owner" &&
    user.approval_status !== "approved"
  ) {
    return <Navigate to="/login" replace />;
  }

  // Role-Based Access Control
  if (user.role !== allowedRole) {
    return (
      <Navigate
        to={dashboardPaths[user.role] || "/login"}
        replace
      />
    );
  }

  return <Outlet />;
}

// ========================================
// ROLE-AWARE DASHBOARD REDIRECT
// ========================================

function DashboardRedirect() {
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    let active = true;

    const verifyAndRedirect = async () => {
      const token = getStoredToken();

      if (!token) {
        if (active) {
          setDestination("/login");
        }
        return;
      }

      try {
        const response = await getMyProfile();
        const user = response.data;

        const path =
          user.role === "shop_owner" &&
          user.approval_status !== "approved"
            ? "/login"
            : dashboardPaths[user.role] || "/login";

        if (active) {
          setDestination(path);
        }
      } catch (error) {
        if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          clearStoredTokens();
        }

        if (active) {
          setDestination("/login");
        }
      }
    };

    verifyAndRedirect();

    return () => {
      active = false;
    };
  }, []);

  if (!destination) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Poppins, sans-serif",
          color: "#5030a0",
        }}
      >
        Loading your dashboard...
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}

// ========================================
// MAIN APPLICATION
// ========================================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ===================================
            PUBLIC ROUTES
        =================================== */}

        <Route
          path="/"
          element={<LandingPage />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        {/* ===================================
            CUSTOMER PROTECTED ROUTES
        =================================== */}

        <Route
          element={<ProtectedRoute allowedRole="customer" />}
        >
          <Route element={<CustomerLayout />}>

            <Route
              path="/customer/dashboard"
              element={<CustomerDashboard />}
            />

            <Route
              path="/food-preferences"
              element={<FoodPreferences />}
            />

            <Route
              path="/meal-plan"
              element={<MealPlan />}
            />

            <Route
              path="/weekly-grocery-basket"
              element={<WeeklyGroceryBasket />}
            />

            <Route
              path="/choose-partner-shop"
              element={<ChoosePartnerShop />}
            />

            <Route
              path="/my-orders"
              element={<MyOrders />}
            />

            <Route
              path="/my-profile"
              element={<MyProfile />}
            />

            <Route
              path="/customer/notifications"
              element={<CustomerNotifications />}
            />
          <Route
            path="/premium-plans"
            element={<PremiumPlans />}
          />
          </Route>
        </Route>

        {/* ===================================
            SHOP OWNER PROTECTED ROUTES
        =================================== */}

        <Route
          element={<ProtectedRoute allowedRole="shop_owner" />}
        >

          <Route
            path="/shop-owner/dashboard"
            element={<ShopOwnerDashboard />}
          />

          <Route
            path="/shop-owner/profile"
            element={<ShopOwnerProfile />}
          />

          <Route
            path="/shop/orders/:orderId/details"
            element={<ShopOwnerBasketDetails />}
          />
          <Route
            path="/shop-owner/notifications"
            element={<ShopOwnerNotifications />}
          />

          <Route
            path="/shop/orders"
            element={<ShopOwnerReceivedOrders />}
          />
          <Route
            path="/shop-owner/subscription"
            element={<ShopOwnerSubscription />}
          />
        </Route>

        {/* ===================================
            ADMIN PROTECTED ROUTES
        =================================== */}

        <Route
          element={<ProtectedRoute allowedRole="admin" />}
        >
          <Route element={<AdminLayout />}>

            <Route
              path="/admin/dashboard"
              element={<AdminDashboard />}
            />

            <Route
              path="/admin/users"
              element={<AdminCustomer />}
            />
            <Route
              path="/admin/shop-owners"
              element={<AdminShopOwners />}
            />
            <Route
              path="/admin/orders"
              element={<AdminOrders />}
            />
            <Route
              path="/admin/reports"
              element={<AdminReports />}
            />
            <Route
               path="/admin/notifications"
              element={<AdminNotifications />}
            />
          </Route>
        </Route>

        {/* ===================================
            ROLE-AWARE DASHBOARD REDIRECT
        =================================== */}

        <Route
          path="/dashboard"
          element={<DashboardRedirect />}
        />

        {/* ===================================
            UNKNOWN ROUTES
        =================================== */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
