import React, { useEffect, useState } from "react";
import type { KeyStatus } from "../types";
import { API_KEY_SLOTS } from "../types";
import { fetchKeys } from "../api";
import ApiKeyRow from "./ApiKeyRow";

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchKeys()
      .then(setKeys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <p className="state-msg">Loading keys...</p>;
  if (error) return <p className="state-msg error">Error: {error}</p>;

  const aiKeys = API_KEY_SLOTS.filter((s) => s.group === "ai");
  const marketKeys = API_KEY_SLOTS.filter((s) => s.group === "marketplace");

  function mergeStatus(slotName: string) {
    return keys.find((k) => k.name === slotName) ?? { name: slotName, envVar: "", configured: false, maskedValue: null };
  }

  return (
    <div>
      <h2>AI Provider Keys</h2>
      <table className="key-table">
        <thead>
          <tr><th>Provider</th><th>Env Var</th><th>Status</th><th>Preview</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {aiKeys.map((slot) => (
            <ApiKeyRow
              key={slot.name}
              keySlot={{ ...mergeStatus(slot.name), label: slot.label, envVar: slot.envVar }}
              onUpdated={load}
            />
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Marketplace Keys</h2>
      <table className="key-table">
        <thead>
          <tr><th>Service</th><th>Env Var</th><th>Status</th><th>Preview</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {marketKeys.map((slot) => (
            <ApiKeyRow
              key={slot.name}
              keySlot={{ ...mergeStatus(slot.name), label: slot.label, envVar: slot.envVar }}
              onUpdated={load}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
