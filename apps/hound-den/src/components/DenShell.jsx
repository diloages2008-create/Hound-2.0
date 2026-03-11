import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/apiClient.js";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/artists", label: "Artists" },
  { to: "/releases", label: "Releases" },
  { to: "/assets", label: "Tracks & Assets" },
  { to: "/users", label: "Users" },
  { to: "/moderation", label: "Moderation" },
  { to: "/catalog", label: "Catalog" },
  { to: "/jobs", label: "Jobs" },
  { to: "/analytics", label: "Analytics" },
  { to: "/system-health", label: "System Health" },
  { to: "/reports", label: "Reports" },
  { to: "/audit", label: "Audit Log" },
  { to: "/settings", label: "Settings" }
];

export default function DenShell({ children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout().catch(() => {});
    navigate("/auth", { replace: true });
  };

  return (
    <div className="studio-shell den-shell">
      <aside className="studio-nav den-nav">
        <div className="brand-mark">
          <span>Hound</span>
          <small>DEN</small>
        </div>
        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-footnote">
          <div style={{ marginBottom: "8px" }}>Admin actions are audited.</div>
          <button type="button" className="secondary-button" onClick={handleLogout} style={{ width: "100%" }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="studio-main">{children}</main>
    </div>
  );
}
