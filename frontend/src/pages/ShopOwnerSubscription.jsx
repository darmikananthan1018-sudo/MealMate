
import React, { useCallback, useEffect, useState } from "react";
import {
  Store,
  CreditCard,
  CalendarDays,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Crown,
  RefreshCw,
  ArrowRight,
  ShoppingBasket,
  ClipboardList,
  RotateCw,
} from "lucide-react";

import api from "../services/api";
import ShopOwnerLayout from "../components/ShopOwnerLayout";
import "../styles/ShopOwnerDashboard.css";

const BUSINESS_PRICE = 7000;

const parseUTC = (value) => {
  if (!value) return null;

  const raw = String(value);
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
    ? raw
    : `${raw}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseUTC(value);

  if (!date) return "Not available";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const getRemainingDays = (subscription) => {
  const endDate = parseUTC(subscription?.end_date);

  if (!endDate) return 0;

  return Math.max(
    0,
    Math.ceil(
      (endDate.getTime() - Date.now()) / 86400000
    )
  );
};

const getData = (response) => response?.data ?? response;

const getSubscriptionList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.subscriptions)) {
    return data.subscriptions;
  }

  const single =
    data?.subscription ||
    data?.current_subscription ||
    data?.active_subscription ||
    data;

  return single && typeof single === "object"
    ? [single]
    : [];
};

const getPlansList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.plans)) return data.plans;
  return [];
};

const isValidActiveSubscription = (item) => {
  if (item?.status !== "active") return false;

  const endDate = parseUTC(item.end_date);
  const startDate = parseUTC(item.start_date);
  const now = Date.now();

  return (
    endDate !== null &&
    endDate.getTime() > now &&
    (!startDate || startDate.getTime() <= now)
  );
};

export default function ShopOwnerSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [subscriptionResponse, plansResponse] =
        await Promise.allSettled([
          api.get("/subscriptions/me"),
          api.get("/subscriptions/plans"),
        ]);

      if (subscriptionResponse.status !== "fulfilled") {
        throw (
          subscriptionResponse.reason ||
          new Error("Unable to load subscription details.")
        );
      }

      const subscriptionData = getData(
        subscriptionResponse.value
      );

      const plansData =
        plansResponse.status === "fulfilled"
          ? getData(plansResponse.value)
          : [];

      const availablePlans = getPlansList(plansData);
      setPlans(availablePlans);

      const subscriptionList =
        getSubscriptionList(subscriptionData);

      const activeSubscriptions = subscriptionList
        .filter(isValidActiveSubscription)
        .sort((a, b) => {
          const aTrial = Number(a.plan_id) === 4;
          const bTrial = Number(b.plan_id) === 4;

          if (aTrial !== bTrial) {
            return aTrial ? 1 : -1;
          }

          return (
            (parseUTC(b.end_date)?.getTime() || 0) -
            (parseUTC(a.end_date)?.getTime() || 0)
          );
        });

      const activeSubscription =
        activeSubscriptions[0] || null;

      const previousSubscription = subscriptionList
        .filter(
          (item) =>
            item.status !== "pending" &&
            item.end_date
        )
        .sort(
          (a, b) =>
            (parseUTC(b.end_date)?.getTime() || 0) -
            (parseUTC(a.end_date)?.getTime() || 0)
        )[0];

      const selected =
        activeSubscription || previousSubscription || null;

      if (!selected) {
        setSubscription(null);
        return;
      }

      const matchingPlan = availablePlans.find(
        (plan) =>
          Number(plan.id) === Number(selected.plan_id)
      );

      const planName =
        selected.plan_name ||
        matchingPlan?.name ||
        (Number(selected.plan_id) === 4
          ? "Shop Owner Free Trial"
          : "Shop Owner Subscription");

      const trial =
        selected.is_trial === true ||
        selected.display_status === "trial" ||
        planName.toLowerCase().includes("trial");

      setSubscription({
        ...selected,
        plan_name: planName,
        is_trial: trial,
        is_valid: Boolean(activeSubscription),
      });
    } catch (err) {
      console.error("Subscription loading error:", err);
      setSubscription(null);

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load subscription details."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const businessPlan = plans.find((plan) => {
    const name = String(plan.name || "").toLowerCase();

    return (
      name.includes("shop owner business") ||
      (name.includes("shop") &&
        Number(plan.price_lkr ?? plan.price) ===
          BUSINESS_PRICE)
    );
  });

  const remainingDays = getRemainingDays(subscription);

  const isTrial =
    subscription?.is_trial === true ||
    subscription?.display_status === "trial" ||
    String(subscription?.plan_name || "")
      .toLowerCase()
      .includes("trial");

  const startDate = parseUTC(subscription?.start_date);
  const endDate = parseUTC(subscription?.end_date);

  const isActive =
    subscription?.status === "active" &&
    endDate !== null &&
    endDate.getTime() > Date.now() &&
    (!startDate || startDate.getTime() <= Date.now());

  const isExpired =
    !isActive &&
    subscription !== null &&
    (subscription.status === "expired" ||
      (endDate !== null &&
        endDate.getTime() <= Date.now()));

  const statusLabel = isActive
    ? isTrial
      ? "Free Trial Active"
      : "Subscription Active"
    : isExpired
      ? "Subscription Expired"
      : "No Active Subscription";

  const handlePayment = async () => {
    if (paying) return;

    if (!businessPlan?.id) {
      setError(
        "Shop Owner Business plan is not available. Please contact support."
      );
      return;
    }

    setPaying(true);
    setError("");

    try {
      const checkoutResponse = await api.post(
        "/subscriptions/checkout",
        { plan_id: businessPlan.id }
      );

      const checkoutData = getData(checkoutResponse);

      const paymentId =
        checkoutData?.payment_id ??
        checkoutData?.payment?.id ??
        checkoutData?.subscription_payment_id ??
        checkoutData?.id;

      if (!paymentId) {
        throw new Error("Payment ID was not returned.");
      }

      const stripeResponse = await api.post(
        `/subscriptions/stripe/checkout/${paymentId}`
      );

      const stripeData = getData(stripeResponse);

      const checkoutUrl =
        stripeData?.checkout_url ||
        stripeData?.url ||
        stripeData?.session_url;

      if (!checkoutUrl) {
        throw new Error(
          "Stripe checkout URL was not returned."
        );
      }

      const url = new URL(checkoutUrl);

      const validStripeUrl =
        url.protocol === "https:" &&
        (url.hostname === "checkout.stripe.com" ||
          url.hostname.endsWith(
            ".checkout.stripe.com"
          ));

      if (!validStripeUrl) {
        throw new Error(
          "Invalid Stripe checkout URL."
        );
      }

      window.location.assign(url.toString());
    } catch (err) {
      console.error("Stripe payment error:", err);

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to start payment."
      );

      setPaying(false);
    }
  };

  const benefits = [
    "Shop visibility in partner shop listings",
    "Receive new customer basket orders",
    "Manage orders from your dashboard",
    "Secure Stripe payment",
  ];

  return (
    <ShopOwnerLayout title="My Subscription">
      <div className="sos-page">
        <div className="sos-container">

          {/* HERO BANNER */}
          <section className="sos-hero">
            <div className="sos-hero-content">
              <div className="sos-hero-badge">
                <Store size={16} />
                MEALMATE PARTNER PORTAL
              </div>

              <h1>
                My <span>Subscription</span>
              </h1>

              <p>
                Manage your shop subscription, free trial
                and payment plan.
              </p>

              <div className="sos-hero-features">
                <span>
                  <CheckCircle2 size={17} />
                  Receive Customer Orders
                </span>

                <span>
                  <CheckCircle2 size={17} />
                  Manage from Dashboard
                </span>

                <span>
                  <CheckCircle2 size={17} />
                  Secure Payment (Stripe)
                </span>
              </div>
            </div>

            <div
              className="sos-hero-art"
              aria-hidden="true"
            >
              <div className="sos-hero-art-circle">
                <div className="sos-hero-art-bag">
                  🛍️
                </div>
                <div className="sos-hero-art-vegetables">
                  🥬 🥕 🍅
                </div>
              </div>
            </div>
          </section>

          {/* REFRESH */}
          <div className="sos-toolbar">
            <span>
              Your subscription overview
            </span>

            <button
              type="button"
              className="sos-refresh-button"
              onClick={loadSubscription}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div className="sos-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="sos-loading">
              Loading subscription details...
            </div>
          ) : (
            <>
              {/* SUMMARY CARDS */}
              <div className="sos-summary-grid">

                <div className="sos-summary-card">
                  <div className="sos-summary-icon">
                    <Store size={25} />
                  </div>

                  <div className="sos-summary-info">
                    <div className="sos-summary-label">
                      Your Plan
                    </div>
                    <div className="sos-summary-value">
                      {subscription?.plan_name ||
                        "No Active Plan"}
                    </div>
                  </div>
                </div>

                <div className="sos-summary-card">
                  <div className="sos-summary-icon">
                    <CalendarDays size={25} />
                  </div>

                  <div className="sos-summary-info">
                    <div className="sos-summary-label">
                      Start Date
                    </div>
                    <div className="sos-summary-value">
                      {formatDate(
                        subscription?.start_date
                      )}
                    </div>
                  </div>
                </div>

                <div className="sos-summary-card">
                  <div className="sos-summary-icon">
                    <CalendarDays size={25} />
                  </div>

                  <div className="sos-summary-info">
                    <div className="sos-summary-label">
                      Expiry Date
                    </div>
                    <div className="sos-summary-value">
                      {formatDate(
                        subscription?.end_date
                      )}
                    </div>
                  </div>
                </div>

                <div className="sos-summary-card">
                  <div className="sos-summary-icon">
                    <Clock3 size={25} />
                  </div>

                  <div className="sos-summary-info">
                    <div className="sos-summary-label">
                      {isTrial
                        ? "Trial Remaining"
                        : "Days Remaining"}
                    </div>
                    <div className="sos-summary-value">
                      {isActive
                        ? `${remainingDays} Days`
                        : "0 Days"}
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM TWO CARDS */}
              <div className="sos-content-grid">

                {/* BUSINESS PLAN */}
                <section className="sos-business-card">

                  <div className="sos-business-heading">
                    <div className="sos-business-icon">
                      <Crown size={28} />
                    </div>

                    <div>
                      <h2>Shop Owner Business</h2>
                      <p className="sos-business-description">
                        Continue receiving customer grocery
                        basket orders through MealMate.
                      </p>
                    </div>
                  </div>

                  <div className="sos-business-price">
                    Rs. 7,000
                    <span> / month</span>
                  </div>

                  <div className="sos-benefits">
                    {benefits.map((benefit) => (
                      <div
                        className="sos-benefit"
                        key={benefit}
                      >
                        <CheckCircle2 size={18} />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  {isActive && (
                    <div className="sos-active-message">
                      <CheckCircle2 size={19} />
                      {isTrial
                        ? "Your 30-day free trial is active."
                        : "Subscription Active"}
                    </div>
                  )}

                  {(!isActive || isTrial) && (
                    <>
                      <button
                        type="button"
                        className="sos-pay-button"
                        onClick={handlePayment}
                        disabled={
                          paying || !businessPlan?.id
                        }
                        style={{ marginTop: 16 }}
                      >
                        <CreditCard size={19} />

                        {paying
                          ? "Redirecting to Stripe..."
                          : "Pay Rs. 7,000"}

                        {!paying && (
                          <ArrowRight size={18} />
                        )}
                      </button>

                      {!businessPlan?.id && (
                        <p className="sos-payment-note">
                          Business plan is currently
                          unavailable. Please contact
                          the administrator.
                        </p>
                      )}
                    </>
                  )}

                  {!isActive && (
                    <p className="sos-inactive-note">
                      <AlertCircle size={16} />
                      {statusLabel}. Activate your
                      business plan to receive new orders.
                    </p>
                  )}
                </section>

                {/* PLAN DETAILS */}
                <section className="sos-details-card">
                  <div className="sos-details-heading">
                    <div className="sos-details-illustration">
                      <ClipboardList size={40} />
                      <CheckCircle2
                        size={23}
                        className="sos-details-check"
                      />
                    </div>

                    <h2 className="sos-details-title">
                      Plan Details
                    </h2>
                  </div>

                  <div className="sos-details-list">

                    <div className="sos-details-row">
                      <Crown size={19} />
                      <span className="sos-details-label">
                        Plan Type
                      </span>
                      <strong className="sos-details-value">
                        {subscription?.plan_name ||
                          "Not available"}
                      </strong>
                    </div>

                    <div className="sos-details-row">
                      <RotateCw size={19} />
                      <span className="sos-details-label">
                        Billing Cycle
                      </span>
                      <strong className="sos-details-value">
                        {isTrial
                          ? "30-Day Free Trial"
                          : isActive
                            ? "Monthly Plan"
                            : "Not active"}
                      </strong>
                    </div>

                    <div className="sos-details-row">
                      <CalendarDays size={19} />
                      <span className="sos-details-label">
                        Current Period Ends
                      </span>
                      <strong className="sos-details-value">
                        {formatDate(
                          subscription?.end_date
                        )}
                      </strong>
                    </div>

                    <div className="sos-details-row">
                      <CreditCard size={19} />
                      <span className="sos-details-label">
                        Payment Provider
                      </span>
                      <strong className="sos-details-value">
                        Stripe
                      </strong>
                    </div>

                    <div className="sos-details-row">
                      <ShieldCheck size={19} />
                      <span className="sos-details-label">
                        Subscription Status
                      </span>
                      <strong className="sos-details-value">
                        {statusLabel}
                      </strong>
                    </div>
                  </div>
                </section>
              </div>

              {/* FOOTER */}
              <div className="sos-footer-note">
                <ShieldCheck size={18} />
                Subscription access is verified by
                MealMate. Payment confirmation is
                processed securely through Stripe.
              </div>
            </>
          )}
        </div>
      </div>
    </ShopOwnerLayout>
  );
}
