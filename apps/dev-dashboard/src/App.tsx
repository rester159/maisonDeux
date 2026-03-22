import React, { useState } from "react";
import Layout from "./components/Layout";
import ApiKeyManager from "./components/ApiKeyManager";
import FunctionRegistry from "./components/FunctionRegistry";

export default function App() {
  const [tab, setTab] = useState<"keys" | "functions">("keys");

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === "keys" && <ApiKeyManager />}
      {tab === "functions" && <FunctionRegistry />}
    </Layout>
  );
}
