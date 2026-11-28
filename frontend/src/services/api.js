
import axios from "axios";

// ========================================
// MEALMATE API CONFIGURATION
// ========================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ========================================
// JWT TOKEN INTERCEPTOR
// ========================================

// Automatically attach JWT token
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("mealmate_token") ||
      localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Allow browser/Axios to set the multipart
    // boundary automatically for photo uploads.
    if (config.data instanceof FormData) {
      config.headers.setContentType(undefined);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ========================================
// AUTHENTICATION APIs
// ========================================

// Customer Registration
export const registerUser = (userData) => {
  return api.post("/auth/register", userData);
};

// Shop Owner Registration
export const registerShopOwner = (shopData) => {
  return api.post(
    "/auth/shop-owner/register",
    shopData
  );
};

// Customer / Shop Owner / Admin Login
export const loginUser = (loginData) => {
  return api.post("/auth/login", loginData);
};

// Get Logged-in User Profile
export const getMyProfile = () => {
  return api.get("/auth/me");
};

// ========================================
// CUSTOMER PROFILE APIs
// ========================================

// Get Customer Profile
export const getCustomerProfile = () => {
  return api.get("/customer/profile/me");
};

// Update Customer Profile
export const updateCustomerProfile = (data) => {
  return api.put(
    "/customer/profile/me",
    data
  );
};

// ========================================
// CUSTOMER PROFILE PHOTO APIs
// ========================================

// Upload / Change Customer Profile Photo
export const uploadCustomerPhoto = (file) => {
  const formData = new FormData();

  formData.append("file", file);

  return api.post(
    "/customer/profile/photo",
    formData
  );
};

// Remove Customer Profile Photo
export const removeCustomerPhoto = () => {
  return api.delete("/customer/profile/photo");
};

// ========================================
// FOOD PREFERENCES APIs
// ========================================

// Create Food Preferences
export const createFoodPreferences = (data) => {
  return api.post(
    "/food-preferences",
    data
  );
};

// Get User Food Preferences
export const getMyFoodPreferences = () => {
  return api.get("/food-preferences/me");
};

// Update Food Preferences
export const updateMyFoodPreferences = (data) => {
  return api.put(
    "/food-preferences/me",
    data
  );
};

// ========================================
// AI MEAL PLAN APIs
// ========================================

// Generate AI Weekly Meal Plan
export const generateWeeklyMealPlan = () => {
  return api.post(
    "/meal-plan/generate",
    null,
    {
      timeout: 180000,
    }
  );
};

// Get Saved AI Meal Plan
export const getMyMealPlan = () => {
  return api.get("/meal-plan/me");
};

// ========================================
// WEEKLY GROCERY BASKET APIs
// ========================================

// Get User's AI Grocery Basket
export const getMyGroceryBasket = () => {
  return api.get(
    "/meal-plan/me/grocery-basket"
  );
};

// Existing Sample Endpoint
export const getSampleGroceryBasket = () => {
  return api.get(
    "/grocery-basket/weekly"
  );
};

// ========================================
// AI GROCERY PRICE ESTIMATION
// ========================================

// Estimate Grocery Item Price
export const estimateGroceryItemPrice = (data) => {
  return api.post(
    "/grocery-basket/estimate-price",
    data,
    {
      timeout: 60000,
    }
  );
};

// ========================================
// DEFAULT EXPORT
// ========================================

// ========================================
// SHOP OWNER PROFILE APIs
// ========================================

export const getShopOwnerProfile = () =>
  api.get("/shop-owner/profile/me");

export const updateShopOwnerProfile = (data) =>
  api.put("/shop-owner/profile/me", data);

// SHOP OWNER IMAGES

export const uploadShopOwnerImage = (imageType, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(
    `/shop-owner/profile/images/${imageType}`,
    formData
  );
};

export const removeShopOwnerImage = (imageType) =>
  api.delete(`/shop-owner/profile/images/${imageType}`);

// SHOP OFFERS

export const getShopOffers = () =>
  api.get("/shop-owner/profile/offers");

export const createShopOffer = (data) =>
  api.post("/shop-owner/profile/offers", data);

export const updateShopOffer = (id, data) =>
  api.put(`/shop-owner/profile/offers/${id}`, data);

export const deleteShopOffer = (id) =>
  api.delete(`/shop-owner/profile/offers/${id}`);

// SHOP HIGHLIGHTS

export const getShopHighlights = () =>
  api.get("/shop-owner/profile/highlights");

export const createShopHighlight = (data) =>
  api.post("/shop-owner/profile/highlights", data);

export const updateShopHighlight = (id, data) =>
  api.patch(`/shop-owner/profile/highlights/${id}`, data);

export const deleteShopHighlight = (id) =>
  api.delete(`/shop-owner/profile/highlights/${id}`);


// ========================================
// SUBSCRIPTION APIs
// ========================================

// Get available subscription plans
export const getSubscriptionPlans = () => {
  return api.get("/subscriptions/plans");
};

// Get current user's subscriptions
export const getMySubscriptions = () => {
  return api.get("/subscriptions/me");
};

// Activate free trial
export const activateFreeTrial = (data) => {
  return api.post("/subscriptions/trial", data);
};

// Create pending subscription payment
export const createSubscriptionCheckout = (data) => {
  return api.post("/subscriptions/checkout", data);
};

// Create Stripe Checkout session
export const createStripeCheckoutSession = (paymentId) => {
  return api.post(
    `/subscriptions/stripe/checkout/${paymentId}`
  );
};

// Cancel subscription
export const cancelMySubscription = () => {
  return api.post("/subscriptions/cancel");
};

export default api;
