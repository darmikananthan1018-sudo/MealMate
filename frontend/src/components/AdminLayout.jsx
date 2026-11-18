
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBasket,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Leaf,
  ChevronDown,
} from "lucide-react";

import "../styles/AdminDashboard.css";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
  },
  {
    label: "Users",
    icon: Users,
    path: "/admin/users",
  },
  {
    label: "Shop Owners",
    icon: Store,
    path: "/admin/shop-owners",
  },
  {
    label: "Orders",
    icon: ShoppingBasket,
    path: "/admin/orders",
  },
  {
    label: "Reports",
    icon: BarChart3,
    path: "/admin/reports",
  },
  {
    label: "Notifications",
    icon: Bell,
    path: "/admin/notifications",
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("mealmate_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");

    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-app-layout">

      {/* SIDEBAR */}
      <aside
        className={`admin-sidebar ${
          sidebarOpen ? "admin-sidebar-open" : ""
        }`}
      >
        <div className="admin-sidebar-logo">
  <img
    src="/images/mealmate-logo.png"
    alt="MealMate Logo"
    className="admin-original-logo"
  />
</div>

          <button
            className="admin-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        

        <div className="admin-menu-title">
          ADMIN MENU
        </div>

        <nav className="admin-sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `admin-nav-link ${
                    isActive ? "admin-nav-active" : ""
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-tip">
            <Leaf size={22} />

            <h4>Manage MealMate with ease!</h4>

            <p>
              Oversee users, partner shops and
              grocery basket orders in one place.
            </p>
          </div>

          <button
            className="admin-sidebar-logout"
            onClick={logout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN CONTENT */}
      <div className="admin-main-area">

        {/* TOP NAVBAR */}
        <header className="admin-topbar">

          <button
            className="admin-mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={23} />
          </button>

          <div className="admin-topbar-title">
            
           
          </div>

          <div className="admin-topbar-right">
            <span className="admin-topbar-role">
              Administrator
            </span>

            <div className="admin-topbar-avatar">
              A
            </div>

            <div className="admin-topbar-user">
              <strong>Admin User</strong>
              <small>Administrator</small>
            </div>

            <ChevronDown size={17} />
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="admin-page-content">
          <Outlet />
        </div>

      </div>
    </div>
  );
}
