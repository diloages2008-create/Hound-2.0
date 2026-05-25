import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { reportClientIssue } from "../lib/apiClient.js";
import { getStudioIssuePayload, recordStudioAction, recordStudioError } from "../lib/diagnostics.js";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload" },
  { to: "/library", label: "Catalog" },
  { to: "/profile", label: "Profile" }
];

export default function StudioShell({ children }) {
  const location = useLocation();
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const handleReportIssue = async () => {
    setReportBusy(true);
    setReportMessage("");
    recordStudioAction("report_issue_clicked", { route: location.pathname });
    try {
      const payload = getStudioIssuePayload(location.pathname);
      const result = await reportClientIssue(payload);
      setReportMessage(`Report submitted: ${result.reportId}`);
    } catch (error) {
      recordStudioError(error);
      setReportMessage(`Report failed: ${error?.message || "unknown error"}`);
    } finally {
      setReportBusy(false);
    }
  };

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
        <div className="nav-footnote">
          Diagnostics capture the last 30 actions automatically.
        </div>
      </aside>
      <main className="studio-main">
        <div className="studio-main-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleReportIssue}
            disabled={reportBusy}
          >
            {reportBusy ? "Submitting..." : "Report a Problem"}
          </button>
          {reportMessage ? <div className="studio-report-message">{reportMessage}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
