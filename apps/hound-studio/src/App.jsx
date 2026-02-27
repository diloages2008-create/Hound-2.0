import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Library from "./pages/Library.jsx";
import Profile from "./pages/Profile.jsx";
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

  if (!state.authed && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

export default function App() {
  return (
    <StudioShell>
      <AuthGate>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<Library />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </AuthGate>
    </StudioShell>
  );
}
