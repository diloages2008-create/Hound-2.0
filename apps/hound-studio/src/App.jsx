import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Library from "./pages/Library.jsx";
import Profile from "./pages/Profile.jsx";
import Operator from "./pages/Operator.jsx";
import Auth from "./pages/Auth.jsx";
import StudioShell from "./components/StudioShell.jsx";
import { getAuthMe, hasSession } from "./lib/apiClient.js";

function AuthGate({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, authed: false, role: null, roles: [] });

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      if (!hasSession()) {
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

  const canUseStudio = state.roles.includes("artist") || state.role === "artist";

  if (state.loading) {
    return (
      <div className="page-wrap">
        <header className="page-header">
          <h1>Checking Session...</h1>
        </header>
      </div>
    );
  }

  if (state.authed && !canUseStudio) {
    return <Navigate to="/auth" replace />;
  }
  if (!state.authed && location.pathname !== "/auth") {
    return <Navigate to="/auth" replace />;
  }
  if (state.authed && location.pathname === "/auth") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<StudioShell><Dashboard /></StudioShell>} />
        <Route path="/upload" element={<StudioShell><Upload /></StudioShell>} />
        <Route path="/library" element={<StudioShell><Library /></StudioShell>} />
        <Route path="/operator" element={<StudioShell><Operator /></StudioShell>} />
        <Route path="/profile" element={<StudioShell><Profile /></StudioShell>} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </AuthGate>
  );
}
