import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Library from "./pages/Library.jsx";
import Profile from "./pages/Profile.jsx";
import Auth from "./pages/Auth.jsx";
import StudioShell from "./components/StudioShell.jsx";
import { getAuthMe, getRefreshToken, getToken } from "./lib/apiClient.js";

function AuthGate({ children }) {
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
          <h1>Checking Session...</h1>
        </header>
      </div>
    );
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
        <Route path="/profile" element={<StudioShell><Profile /></StudioShell>} />
      </Routes>
    </AuthGate>
  );
}
