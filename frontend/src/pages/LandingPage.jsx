import React from "react";
import { Link } from "react-router-dom";
import "../styles/AuthPages.css";

const features = [
  {
    title: "AI Weekly Meal Planner",
    description:
      "Get personalized weekly meal plans based on your family, budget, and food preferences.",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "Nutrition Information",
    description:
      "Understand the nutritional value of your meals and make healthier food choices.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "Weekly Grocery Basket",
    description:
      "Generate a grocery basket from your meal plan and share it with a partner shop.",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85",
  },
];

const scrollingFoods = [
  "🍚Red Rice",
  "🍛Dhal",
  "🥒Okra",
  "🥭Jackfruit",
  "🍆Bitter Gourd",
  "🍅Green Gram",
  "🍃Gotukola",
  "🥕Carrot",
  "🎃Pumpkin",
  "🍌Banana",
];

const baskets = [
  {
    title: "Essentials Box",
    price: "Rs. 1,500",
    description: "Fresh everyday vegetables",
    image:
      "https://images.pexels.com/photos/2255924/pexels-photo-2255924.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    title: "Family Box",
    price: "Rs. 3,000",
    description: "Healthy vegetables and fruits",
    image:
      "https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    title: "Deluxe Box",
    price: "Rs. 5,000",
    description: "A variety of fresh produce",
    image:
      "https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

function LandingPage() {
  return (
    <div className="mm-landing">

      {/* NAVBAR */}
      <nav className="mm-navbar">
        <Link to="/" className="mm-logo">
          <img
            src="/images/mealmate-logo.png"
            alt="MealMate Logo"
            className="mm-logo-image"
          />
        </Link>

        <div className="mm-nav-links">
          <Link to="/" className="mm-nav-link">
            Home
          </Link>
          <a href="#about" className="mm-nav-link">
            Features
          </a>
        </div>

        <div className="nav-actions">
          <Link to="/login" className="mm-nav-login">
            Login
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="mm-hero">
        <div className="mm-hero-content">
          <span className="mm-eyebrow">
            🌱 Your Smart Nutrition Companion
          </span>

          <h1>
            Healthy Eating,
            <br />
            <span>Made Simple.</span>
          </h1>

          <p>
            Plan your weekly meals with AI, explore nutrition
            information and create your grocery basket — all in one place.
          </p>

          <div className="mm-hero-actions">
            <Link to="/register" className="mm-btn">
              Start Your Healthy Journey →
            </Link>
          </div>
        </div>

        <div className="mm-hero-visual" aria-hidden="true"></div>
      </section>

      {/* FOOD MARQUEE */}
      <section
        className="mm-food-marquee"
        aria-label="Healthy food varieties"
      >
        <div className="mm-marquee-track">
          {[0, 1].map((copy) => (
            <div
              className="mm-marquee-group"
              key={copy}
              aria-hidden={copy === 1}
            >
              {scrollingFoods.map((food) => (
                <div className="mm-marquee-item" key={food}>
                  <span className="mm-food-name">{food}</span>
                  <span className="mm-marquee-star" aria-hidden="true">
                    ✦
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* WEEKLY HARVEST BASKETS */}
      <section
        className="harvest-section"
        id="weekly-baskets"
        style={{
          backgroundImage: 'url("/images/harvest-background.png")',
          backgroundColor: "#FFF0DF",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="harvest-container">
          <div className="harvest-intro">
            <span className="harvest-label">
              FRESH & HEALTHY
            </span>

            <h2>Weekly Harvest Baskets</h2>

            <p>
              Fresh vegetables and fruits, thoughtfully
              selected for your family's healthy weekly meals.
            </p>

            <Link to="/login" className="harvest-button">
              Choose Your Basket →
            </Link>
          </div>

          <div className="harvest-cards">
            {baskets.map((basket) => (
              <div className="harvest-card" key={basket.title}>
                <img
                  src={basket.image}
                  alt={basket.title}
                  loading="lazy"
                />

                <div className="harvest-card-content">
                  <h3>{basket.title}</h3>
                  <strong>{basket.price}</strong>
                  <p>{basket.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI WEEKLY MEAL PLANNER - DIRECTLY BELOW HARVEST */}
      <section className="mm-ai-feature" id="ai-meal-planner">
        <div className="mm-ai-feature-container">
          <div className="mm-ai-feature-left">
            <span className="mm-ai-feature-label">
              🌿 FEATURED FEATURE
            </span>

            <h2>AI Weekly Meal Planner</h2>

            <p>
              Get customized meal plans, automatic grocery lists
              and nutrition breakdowns — all powered by AI.
            </p>

            <Link to="/login" className="mm-ai-feature-btn">
              Try Meal Planner →
            </Link>
          </div>

          <div className="mm-ai-feature-right">
            <div className="mm-ai-plan-heading">
              <h3>This Week's Plan</h3>
              <span>7-Day Preview</span>
            </div>

            <div className="mm-ai-days">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day) => (
                  <span key={day}>{day}</span>
                )
              )}
            </div>

            <div className="mm-ai-meal-row">
              <img src="/images/oats.jpg" alt="Oats with fruits" />
              <div>
                <h4>Oats with Fruits</h4>
                <p>320 kcal</p>
              </div>
              <span>Breakfast</span>
            </div>

            <div className="mm-ai-meal-row">
              <img src="/images/salad.jpg" alt="Chickpea salad" />
              <div>
                <h4>Grilled Chickpea Salad</h4>
                <p>450 kcal</p>
              </div>
              <span>Lunch</span>
            </div>

            <div className="mm-ai-meal-row">
              <img src="/images/curry.jpg" alt="Vegetable curry" />
              <div>
                <h4>Vegetable Curry</h4>
                <p>380 kcal</p>
              </div>
              <span>Dinner</span>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE MEALMATE */}
      <section className="mm-smart-section" id="features">
        <div className="mm-smart-container">
          <div className="mm-smart-left">
            <span className="mm-new-label">
              🌿 WHY CHOOSE MEALMATE
            </span>

            <h2>
              A Smarter Way to <span>Eat Healthy</span>
            </h2>

            <div className="mm-benefits-grid">
              {[
                ["🌿", "Easy to Use", "Simple & intuitive"],
                ["⏱", "Save Time", "Plan in minutes"],
                ["🥗", "Stay Healthy", "Personalized nutrition"],
                ["💰", "Budget Friendly", "Compare local prices"],
              ].map(([icon, title, desc]) => (
                <div className="mm-benefit" key={title}>
                  <div className="mm-benefit-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mm-smart-right">
            <div className="mm-food-promo">
              <div className="mm-promo-text">
                <span>✦ EAT BETTER</span>

                <h3>
                  Good Food
                  <br />
                  Better
                  <br />
                  Tomorrow
                </h3>

                <Link to="/register" className="mm-promo-arrow">
                  →
                </Link>
              </div>

              <img
                src="/images/healthy-bowl.png"
                alt="Healthy food bowl"
                className="mm-promo-bowl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW MEALMATE WORKS */}
<section className="mealmate-process-section">
  <div className="mealmate-process-layout">

    <div className="mealmate-process-content">

      <p className="mealmate-process-label">
        🌿 GET STARTED IN 5 STEPS
      </p>

      <h2 className="mealmate-process-title">
        How MealMate Works
      </h2>

      <div className="mealmate-process-steps">

        {/* STEP 1 */}
        <div className="mealmate-process-step">
          <div className="mealmate-process-icon">▦</div>
          <h3>1. Plan Your Meals</h3>
          <p>
            Get personalized meal plans based on your goals.
          </p>
        </div>

        <span className="mealmate-process-arrow">→</span>

        {/* STEP 2 */}
        <div className="mealmate-process-step">
          <div className="mealmate-process-icon">🧺</div>
          <h3>2. Create Your Basket</h3>
          <p>
            Add ingredients with estimated local prices.
          </p>
        </div>

        <span className="mealmate-process-arrow">→</span>

        {/* STEP 3 */}
        <div className="mealmate-process-step">
          <div className="mealmate-process-icon">🏪</div>
          <h3>3. Choose a Partner Shop</h3>
          <p>
            Select a nearby partner shop.
          </p>
        </div>

        <span className="mealmate-process-arrow">→</span>

        {/* STEP 4 */}
        <div className="mealmate-process-step">
          <div className="mealmate-process-icon">📦</div>
          <h3>4. Track Your Order</h3>
          <p>
            Follow your basket order status.
          </p>
        </div>

        <span className="mealmate-process-arrow">→</span>

        {/* STEP 5 */}
        <div className="mealmate-process-step">
          <div className="mealmate-process-icon">♥</div>
          <h3>5. Enjoy & Stay Healthy</h3>
          <p>
            Cook, eat and live a healthier life.
          </p>
        </div>

      </div>
    </div>

  </div>
</section>

      {/* FOOTER */}
      <footer className="mm-footer">
        <div className="mm-footer-container">
          <div className="mm-footer-brand">
            <Link to="/" className="mm-footer-logo">
              <img
                src="/images/mealmate-logo.png"
                alt="MealMate Logo"
              />
              <span>MealMate</span>
            </Link>

            <p className="mm-footer-tagline">
              Plan Smart. Eat Healthy.
            </p>

            <p className="mm-footer-description">
              Making healthy meal planning simple,
              affordable, and accessible for every family.
            </p>
          </div>

          <div className="mm-footer-column">
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/login">AI Meal Planner</Link>
            <Link to="/login">Weekly Grocery Basket</Link>
            <a href="/#about">Our Features</a>
          </div>

          <div className="mm-footer-column">
            <h4>Support</h4>
            <a href="mailto:support@mealmate.com">
              Contact Us
            </a>
            <a href="/#about">About MealMate</a>
            <Link to="/login">Get Started</Link>
          </div>

          <div className="mm-footer-social">
            <h4>Follow Us</h4>

            <div className="mm-social-icons">
              <span aria-label="Facebook" title="Facebook">f</span>
              <span aria-label="Instagram" title="Instagram">◎</span>
              <span aria-label="YouTube" title="YouTube">▶</span>
            </div>

            <p className="mm-footer-message">
              Good Food.
              <br />
              Better Living.
              <br />
              <strong>Healthier Tomorrows.</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

