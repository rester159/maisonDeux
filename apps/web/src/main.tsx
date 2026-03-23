import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { SettingsPage } from "./pages/SettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ComparePage } from "./pages/ComparePage";
import "./App.css";

function AppRouter() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    return localStorage.getItem("maisondeux_logged_in") === "true";
  });

  const handleLogin = () => {
    localStorage.setItem("maisondeux_logged_in", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("maisondeux_logged_in");
    setIsLoggedIn(false);
  };

  return (
    <Routes>
      {/* Public pages — no login required */}
      <Route path="/compare" element={<ComparePage />} />

      {/* Dashboard — login required */}
      {!isLoggedIn ? (
        <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
      ) : (
        <Route element={<DashboardLayout onLogout={handleLogout} />}>
          <Route path="/" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/settings" replace />} />
        </Route>
      )}
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </React.StrictMode>
);
