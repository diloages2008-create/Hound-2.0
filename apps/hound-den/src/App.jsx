import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import DenAuth from "./pages/DenAuth.jsx";
import DenDashboard from "./pages/DenDashboard.jsx";
import DenArtists from "./pages/DenArtists.jsx";
import DenReleases from "./pages/DenReleases.jsx";
import DenReleaseDetail from "./pages/DenReleaseDetail.jsx";
import DenJobs from "./pages/DenJobs.jsx";
import DenModeration from "./pages/DenModeration.jsx";
import DenReports from "./pages/DenReports.jsx";
import DenAudit from "./pages/DenAudit.jsx";
import DenPlaceholder from "./pages/DenPlaceholder.jsx";
import DenShell from "./components/DenShell.jsx";
import { getAuthMe, getRefreshToken, getToken } from "./lib/apiClient.js";

function AdminGate({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, authed: false, role: null });

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const hasSession = Boolean(getToken() || getRefreshToken());
      if (!hasSession) {
        if (mounted) setState({ loading: false, authed: false, role: null });
        return;
      }
      try {
        const me = await getAuthMe();
        if (mounted) setState({ loading: false, authed: true, role: me.role || null });
      } catch {
        if (mounted) setState({ loading: false, authed: false, role: null });
      }
    };
    boot();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  if (state.loading) {
    return (
      <div className="page-wrap">
        <header className="page-header">
          <h1>Checking Admin Session...</h1>
        </header>
      </div>
    );
  }

  if (!state.authed && location.pathname !== "/auth") {
    return <Navigate to="/auth" replace />;
  }

  if (state.authed && state.role !== "admin") {
    return <Navigate to="/auth" replace />;
  }

  if (state.authed && location.pathname === "/auth") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AdminGate>
      <Routes>
        <Route path="/auth" element={<DenAuth />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DenShell><DenDashboard /></DenShell>} />
        <Route path="/artists" element={<DenShell><DenArtists /></DenShell>} />
        <Route path="/releases" element={<DenShell><DenReleases /></DenShell>} />
        <Route path="/releases/:releaseId" element={<DenShell><DenReleaseDetail /></DenShell>} />
        <Route path="/jobs" element={<DenShell><DenJobs /></DenShell>} />
        <Route path="/moderation" element={<DenShell><DenModeration /></DenShell>} />
        <Route path="/reports" element={<DenShell><DenReports /></DenShell>} />
        <Route path="/audit" element={<DenShell><DenAudit /></DenShell>} />

        <Route path="/assets" element={<DenShell><DenPlaceholder title="Tracks & Assets" description="Asset inventory and pipeline actions (retry transcode, replace asset, archive) live here." /></DenShell>} />
        <Route path="/users" element={<DenShell><DenPlaceholder title="Users" description="Listener account controls and telemetry summaries are staged for Phase 2." /></DenShell>} />
        <Route path="/catalog" element={<DenShell><DenPlaceholder title="Catalog" description="Editorial featuring, shelf curation, and visibility controls live here." /></DenShell>} />
        <Route path="/analytics" element={<DenShell><DenPlaceholder title="Analytics" description="Operational telemetry metrics are scaffolded here for Phase 2." /></DenShell>} />
        <Route path="/system-health" element={<DenShell><DenPlaceholder title="System Health" description="API, DB, storage, worker, stream, and deploy health panels are staged here." /></DenShell>} />
        <Route path="/settings" element={<DenShell><DenPlaceholder title="Settings" description="Admin configuration, RBAC tuning, and 2FA readiness controls live here." /></DenShell>} />
      </Routes>
    </AdminGate>
  );
}
