import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Library from "./pages/Library.jsx";
import Profile from "./pages/Profile.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/library" element={<Library />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}
