import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Library from "./pages/Library.jsx";
import Profile from "./pages/Profile.jsx";
import Operator from "./pages/Operator.jsx";
import Auth from "./pages/Auth.jsx";
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
import StudioShell from "./components/StudioShell.jsx";
import DenShell from "./components/DenShell.jsx";
import { getAuthMe, getRefreshToken, getToken } from "./lib/apiClient.js";

function AuthGate({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, authed: false, role: null, roles: [] });

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const hasSession = Boolean(getToken() || getRefreshToken());
      if (!hasSession) {
        if (mounted) setState({ loading: false, authed: false, role: null, roles: [] });
        return;
      }
      try {
        const me = await getAuthMe();
        if (mounted) setState({
          loading: false,
          authed: true,
          role: me.role || null,
          roles: Array.isArray(me.roles) ? me.roles : []
        });
      } catch {
        if (mounted) setState({ loading: false, authed: false, role: null, roles: [] });
      }
    };
    boot();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const inDen = location.pathname.startsWith("/den");
  const canUseStudio = state.roles.includes("artist") || state.role === "artist";
  const canUseDen = state.roles.includes("admin") || state.role === "admin";

  if (state.loading) {
    return (
      <div className="page-wrap">
        <header className="page-header">
          <h1>Checking Session...</h1>
        </header>
      </div>
    );
  }

  if (inDen) {
    if (!state.authed && location.pathname !== "/den/auth") {
      return <Navigate to="/den/auth" replace />;
    }
    if (state.authed && !canUseDen) {
      return <Navigate to="/auth" replace />;
    }
    if (state.authed && location.pathname === "/den/auth") {
      return <Navigate to="/den/dashboard" replace />;
    }
  } else {
    if (state.authed && !canUseStudio) {
      return <Navigate to="/auth" replace />;
    }
    if (!state.authed && location.pathname !== "/auth") {
      return <Navigate to="/auth" replace />;
    }
    if (state.authed && location.pathname === "/auth") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/den/auth" element={<DenAuth />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<StudioShell><Dashboard /></StudioShell>} />
        <Route path="/upload" element={<StudioShell><Upload /></StudioShell>} />
        <Route path="/library" element={<StudioShell><Library /></StudioShell>} />
        <Route path="/operator" element={<StudioShell><Operator /></StudioShell>} />
        <Route path="/profile" element={<StudioShell><Profile /></StudioShell>} />

        <Route path="/den" element={<Navigate to="/den/dashboard" replace />} />
        <Route path="/den/dashboard" element={<DenShell><DenDashboard /></DenShell>} />
        <Route path="/den/artists" element={<DenShell><DenArtists /></DenShell>} />
        <Route path="/den/releases" element={<DenShell><DenReleases /></DenShell>} />
        <Route path="/den/releases/:releaseId" element={<DenShell><DenReleaseDetail /></DenShell>} />
        <Route path="/den/jobs" element={<DenShell><DenJobs /></DenShell>} />
        <Route path="/den/moderation" element={<DenShell><DenModeration /></DenShell>} />
        <Route path="/den/reports" element={<DenShell><DenReports /></DenShell>} />
        <Route path="/den/audit" element={<DenShell><DenAudit /></DenShell>} />

        <Route path="/den/assets" element={<DenShell><DenPlaceholder title="Tracks & Assets" description="Asset inventory and pipeline actions (retry transcode, replace asset, archive) live here." /></DenShell>} />
        <Route path="/den/users" element={<DenShell><DenPlaceholder title="Users" description="Listener account controls and telemetry summaries are staged for Phase 2." /></DenShell>} />
        <Route path="/den/catalog" element={<DenShell><DenPlaceholder title="Catalog" description="Editorial featuring, shelf curation, and visibility controls live here." /></DenShell>} />
        <Route path="/den/analytics" element={<DenShell><DenPlaceholder title="Analytics" description="Operational telemetry metrics are scaffolded here for Phase 2." /></DenShell>} />
        <Route path="/den/system-health" element={<DenShell><DenPlaceholder title="System Health" description="API, DB, storage, worker, stream, and deploy health panels are staged here." /></DenShell>} />
        <Route path="/den/settings" element={<DenShell><DenPlaceholder title="Settings" description="Admin configuration, RBAC tuning, and 2FA readiness controls live here." /></DenShell>} />
      </Routes>
    </AuthGate>
  );
}
