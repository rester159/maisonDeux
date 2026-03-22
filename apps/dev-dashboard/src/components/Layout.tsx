import React from "react";

type Tab = "keys" | "functions";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, onTabChange, children }: Props) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="logo">MaisonDeux</h1>
        <p className="logo-sub">Dev Dashboard</p>
        <nav>
          <button
            className={`nav-btn ${activeTab === "keys" ? "active" : ""}`}
            onClick={() => onTabChange("keys")}
          >
            API Keys
          </button>
          <button
            className={`nav-btn ${activeTab === "functions" ? "active" : ""}`}
            onClick={() => onTabChange("functions")}
          >
            AI Functions
          </button>
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
