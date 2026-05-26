import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/apiClient.js";

const links = [
  { to: "/den/dashboard", label: "Dashboard" },
  { to: "/den/artists", label: "Artists" },
  { to: "/den/releases", label: "Releases" },
  { to: "/den/assets", label: "Tracks & Assets" },
  { to: "/den/users", label: "Users" },
  { to: "/den/moderation", label: "Moderation" },
  { to: "/den/catalog", label: "Catalog" },
  { to: "/den/jobs", label: "Jobs" },
  { to: "/den/analytics", label: "Analytics" },
  { to: "/den/system-health", label: "System Health" },
  { to: "/den/reports", label: "Reports" },
  { to: "/den/audit", label: "Audit Log" },
  { to: "/den/settings", label: "Settings" }
];

export default function DenShell({ children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout().catch(() => {});
    navigate("/den/auth", { replace: true });
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
