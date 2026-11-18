
import React, { useEffect, useState } from "react";
import {
  Crown,
  Sparkles,
  Leaf,
  Check,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Clock3,
  CircleCheck,
  UserRound,
  Utensils,
  BarChart3,
  Coins,
  RefreshCw,
} from "lucide-react";

import {
  getSubscriptionPlans,
  getMySubscriptions,
  createSubscriptionCheckout,
  createStripeCheckoutSession,
} from "../services/api";

import "../styles/CustomerDashboard.css";

const benefits = [
  "Personalized AI meal planning",
  "Weekly grocery planning",
  "Detailed nutrition information",
  "Budget-friendly planning",
];

const features = [
  {
    icon: Utensils,
    title: "Smarter Meal Plans",
    description: "AI-powered & personalized",
  },
  {
    icon: BarChart3,
    title: "Better Nutrition",
    description: "Track your daily intake",
  },
  {
    icon: Clock3,
    title: "Save Time",
    description: "Plan your week in minutes",
  },
  {
    icon: Coins,
    title: "Stay Within Budget",
    description: "Healthy meals, affordable costs",
  },
];

const formatPrice = (price) =>
  Number(price || 0).toLocaleString("en-LK");

const getErrorMessage = (error) => {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  return error.message || "Something went wrong.";
};

export default function PremiumPlans() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [plansRes, subsRes] = await Promise.all([
          getSubscriptionPlans(),
          getMySubscriptions(),
        ]);

        if (!mounted) return;

        setPlans(
          plansRes.data.filter(
            (plan) => plan.user_role === "customer"
          )
        );

        setSubscriptions(subsRes.data);
      } catch (err) {
        if (mounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const freePlan = plans.find(
    (plan) => Number(plan.price) === 0
  );

  const premiumPlan = plans.find(
    (plan) => Number(plan.price) > 0
  );

  const activeSubscription = subscriptions.find(
    (subscription) => subscription.status === "active"
  );

  const currentPlan = plans.find(
    (plan) => plan.id === activeSubscription?.plan_id
  );

  const activePaidSubscription = subscriptions.find(
    (subscription) =>
      subscription.status === "active" &&
      plans.some(
        (plan) =>
          plan.id === subscription.plan_id &&
          Number(plan.price) > 0
      )
  );

  const hasPendingSubscription = subscriptions.some(
    (subscription) => subscription.status === "pending"
  );

  const currentPlanName =
    currentPlan?.name || "No Active Plan";

  const subscriptionStatus =
    activeSubscription?.status || "Inactive";

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-GB");
  };

  // Uses the existing authenticated backend; no changes to api.js required.
  const subscriptionRequest = async (path, body = {}) => {
    const token = localStorage.getItem("mealmate_token");
    const response = await fetch(`http://127.0.0.1:8000${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${response.status})`);
    }
    return data;
  };

  const refreshSubscriptions = async () => {
    const response = await getMySubscriptions();
    setSubscriptions(response.data);
  };

  const handleStartTrial = async () => {
    if (!freePlan || processingId !== null || activeSubscription) return;
    setProcessingId("trial");
    setError("");
    setNotice("");
    try {
      await subscriptionRequest("/subscriptions/trial", { plan_id: freePlan.id });
      await refreshSubscriptions();
      setNotice("Your free trial has been activated.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription || processingId !== null) return;

    setProcessingId("cancel");
    setError("");
    setNotice("");
    try {
      await subscriptionRequest("/subscriptions/cancel", { subscription_id: activeSubscription.id });
      await refreshSubscriptions();
      setNotice("Subscription cancellation request completed.");
      setShowCancelModal(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handlePremiumCheckout = async () => {
    if (
      !premiumPlan ||
      processingId !== null ||
      activePaidSubscription
    ) {
      return;
    }

    setProcessingId(premiumPlan.id);
    setError("");

    try {
      const paymentResponse =
        await createSubscriptionCheckout({
          plan_id: premiumPlan.id,
        });

      const paymentId = paymentResponse.data.id;

      if (!paymentId) {
        throw new Error("Payment ID is missing.");
      }

      const stripeResponse =
        await createStripeCheckoutSession(paymentId);

      const checkoutUrl =
        stripeResponse.data.checkout_url;

      if (!checkoutUrl) {
        throw new Error("Stripe checkout URL is missing.");
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(getErrorMessage(err));
      setProcessingId(null);
    }
  };

  const paymentResult = new URLSearchParams(window.location.search).get("payment");

  if (loading) {
    return (
      <div className="pp-loading">
        <RefreshCw className="pp-spin" size={26} />
        Loading Premium Plans...
      </div>
    );
  }

  return (
    <div className="pp-page">
      {/* HERO SECTION */}
      <section className="pp-hero">
        <div className="pp-hero-content">
          <div className="pp-hero-badge">
            <Crown size={15} />
            MEALMATE PREMIUM
          </div>

          <h1>
            <Sparkles size={29} />
            Premium <span>Plans</span>
          </h1>

          <p>
            Unlock smarter meal planning, weekly grocery
            organization and personalized nutrition guidance
            with MealMate Premium.
          </p>

          <div className="pp-hero-highlights">
            <span>
              <CheckCircle2 size={15} />
              Personalized Plans
            </span>

            <span>
              <CheckCircle2 size={15} />
              Nutrition Insights
            </span>

            <span>
              <CheckCircle2 size={15} />
              Budget Friendly
            </span>
          </div>
        </div>

        <div className="pp-hero-visual">
          <div className="pp-hero-circle" />

          <img
            src="/images/premium-hero.png"
            alt="Healthy MealMate grocery planning"
          />

          <div className="pp-floating-crown">
            <Crown size={30} />
          </div>
        </div>
      </section>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="pp-error" role="alert">
          {error}
        </div>
      )}

      {notice && <div className="pp-security" role="status">{notice}</div>}
      {paymentResult === "success" && (
        <div className="pp-security" role="status">
          Stripe checkout returned successfully. Check your subscription status below.
        </div>
      )}
      {paymentResult === "cancel" && (
        <div className="pp-error" role="status">Checkout was cancelled. No new payment was confirmed.</div>
      )}

      {/* SUMMARY CARDS */}
      <section className="pp-stats">
        <div className="pp-stat pp-stat-purple">
          <div className="pp-stat-icon">
            <Crown size={24} />
          </div>

          <div>
            <span>Your Plan</span>
            <strong>{currentPlanName}</strong>
          </div>
        </div>

        <div className="pp-stat pp-stat-lime">
          <div className="pp-stat-icon">
            <CalendarDays size={24} />
          </div>

          <div>
            <span>Plan Ends</span>
            <strong>
              {formatDate(activeSubscription?.end_date)}
            </strong>
          </div>
        </div>

        <div className="pp-stat pp-stat-pink">
          <div className="pp-stat-icon">
            <UserRound size={24} />
          </div>

          <div>
            <span>Plan Type</span>
            <strong>
              {currentPlan
                ? Number(currentPlan.price) > 0
                  ? "Premium"
                  : "Free Trial"
                : "Not Selected"}
            </strong>
          </div>
        </div>

        <div className="pp-stat pp-stat-green">
          <div className="pp-stat-icon">
            <CircleCheck size={24} />
          </div>

          <div>
            <span>Status</span>
            <strong className="pp-capitalize">
              {subscriptionStatus}
            </strong>
          </div>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="pp-pricing-grid">
        {/* FREE TRIAL */}
        <article className="pp-plan pp-free">
          <div className="pp-plan-top">
            <div className="pp-plan-icon">
              <Leaf size={27} />
            </div>

            <div>
              <h2>
                {freePlan?.name || "Customer Free Trial"}
              </h2>

              <p>
                {freePlan?.description ||
                  "Try MealMate with a free trial."}
              </p>
            </div>
          </div>

          <div className="pp-plan-price pp-green-price">
            Rs. {formatPrice(freePlan?.price)}
            <span>
              / {freePlan?.duration_days || 21} days
            </span>
          </div>

          <div className="pp-plan-divider" />

          <div className="pp-benefit-list">
            {benefits.map((benefit) => (
              <div key={benefit}>
                <Check size={17} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pp-plan-bottom">
            <button
              type="button"
              className="pp-free-button"
              onClick={handleStartTrial}
              disabled={!freePlan || processingId !== null || Boolean(activeSubscription)}
              style={{ cursor: activeSubscription ? "default" : "pointer", border: 0 }}
            >
              {activeSubscription?.plan_id === freePlan?.id
                ? "Current Trial"
                : activeSubscription
                ? "Subscription Active"
                : processingId === "trial"
                ? "Activating..."
                : "Start Free Trial"}
              <CheckCircle2 size={18} />
            </button>
          </div>
        </article>

        {/* PREMIUM */}
        <article className="pp-plan pp-premium">
          <div className="pp-popular">
            <Sparkles size={15} />
            MOST POPULAR
          </div>

          <div className="pp-plan-top">
            <div className="pp-plan-icon">
              <Crown size={27} />
            </div>

            <div>
              <h2>
                {premiumPlan?.name || "Customer Premium"}
              </h2>

              <p>
                {premiumPlan?.description ||
                  "Unlock advanced AI meal planning."}
              </p>
            </div>
          </div>

          <div className="pp-plan-price pp-purple-price">
            Rs. {formatPrice(premiumPlan?.price)}
            <span>
              / {premiumPlan?.duration_days || 30} days
            </span>
          </div>

          <div className="pp-plan-divider" />

          <div className="pp-benefit-list">
            {benefits.map((benefit) => (
              <div key={benefit}>
                <Check size={17} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pp-plan-bottom">
            <button
              type="button"
              className="pp-premium-button"
              onClick={handlePremiumCheckout}
              disabled={
                !premiumPlan ||
                processingId !== null ||
                Boolean(activePaidSubscription) ||
                hasPendingSubscription
              }
            >
              {activePaidSubscription
                ? "Current Premium Plan"
                : processingId !== null
                ? "Redirecting to Stripe..."
                : hasPendingSubscription
                ? "Checkout Pending"
                : "Get Premium Now"}

              {!activePaidSubscription &&
                processingId === null && (
                  <ArrowRight size={19} />
                )}
            </button>
          </div>
        </article>
      </section>

      {activeSubscription && (
        <section className="pp-security" style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <span>Current subscription: <strong>{currentPlanName}</strong> — {subscriptionStatus}</span>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            disabled={processingId !== null}
            style={{ border: "1px solid #69315f", color: "#69315f", background: "white", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
          >
            {processingId === "cancel" ? "Cancelling..." : "Cancel Subscription"}
          </button>
        </section>
      )}

      {/* WHY PREMIUM */}
      <section className="pp-features">
        <h2>Why Go Premium?</h2>

        <div className="pp-feature-list">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                className="pp-feature"
                key={feature.title}
              >
                <div className="pp-feature-icon">
                  <Icon size={24} />
                </div>

                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CUSTOM CANCEL SUBSCRIPTION MODAL */}
      {showCancelModal && (
        <div className="pp-modal-overlay">
          <div
            className="pp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pp-cancel-title"
            aria-describedby="pp-cancel-description"
          >
            <div className="pp-modal-icon"><Crown size={30} /></div>
            <h2 id="pp-cancel-title">Cancel Subscription?</h2>
            <p id="pp-cancel-description">
              Are you sure you want to cancel your MealMate Premium subscription?
            </p>
            {error && <p className="pp-modal-error" role="alert">{error}</p>}
            <div className="pp-modal-actions">
              <button
                type="button"
                className="pp-modal-keep"
                disabled={processingId === "cancel"}
                onClick={() => setShowCancelModal(false)}
              >
                Keep My Plan
              </button>
              <button
                type="button"
                className="pp-modal-cancel"
                disabled={processingId === "cancel"}
                onClick={handleCancelSubscription}
              >
                {processingId === "cancel" ? "Processing..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY */}
      <div className="pp-security">
        <ShieldCheck size={18} />
        Secure payments powered by Stripe.
        Your subscription is activated after
        successful payment confirmation.
      </div>
    </div>
  );
}
