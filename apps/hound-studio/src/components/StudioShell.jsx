import React from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload" },
  { to: "/library", label: "Catalog" },
  { to: "/profile", label: "Profile" }
];

export default function StudioShell({ children }) {
  return (
    <div className="studio-shell">
      <aside className="studio-nav">
        <div className="brand-mark">
          <span>Hound</span>
          <small>Studio</small>
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
      </aside>
      <main className="studio-main">{children}</main>
    </div>
  );
}
