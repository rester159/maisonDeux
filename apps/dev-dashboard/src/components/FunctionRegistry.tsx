import React, { useEffect, useState } from "react";
import type { FunctionWithAssignment, ProviderStatus } from "../types";
import { fetchFunctions, fetchProviders, assignModel } from "../api";
import FunctionCard from "./FunctionCard";
import AddModelDialog from "./AddModelDialog";

export default function FunctionRegistry() {
  const [functions, setFunctions] = useState<FunctionWithAssignment[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([fetchFunctions(), fetchProviders()])
      .then(([fns, provs]) => {
        setFunctions(fns);
        setProviders(provs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleModelChange(functionId: string, modelId: string) {
    try {
      await assignModel(functionId, modelId);
      setFunctions((prev) =>
        prev.map((f) =>
          f.id === functionId ? { ...f, currentModelId: modelId || null } : f
        )
      );
    } catch (e: any) {
      alert(`Failed to assign model: ${e.message}`);
    }
  }

  if (loading) return <p className="state-msg">Loading functions...</p>;
  if (error) return <p className="state-msg error">Error: {error}</p>;

  return (
    <div>
      <div className="section-header">
        <h2>AI Functions</h2>
        <span className="hint">* = recommended model</span>
      </div>
      <div className="function-grid">
        {functions.map((fn) => (
          <FunctionCard
            key={fn.id}
            func={fn}
            providers={providers}
            onModelChange={handleModelChange}
            onAddModel={() => setShowAddDialog(true)}
          />
        ))}
      </div>
      {showAddDialog && (
        <AddModelDialog
          onClose={() => setShowAddDialog(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
