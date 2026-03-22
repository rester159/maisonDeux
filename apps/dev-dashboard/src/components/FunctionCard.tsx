import React from "react";
import type { FunctionWithAssignment, ProviderStatus } from "../types";
import { AI_MODELS } from "../types";
import ModelSelector from "./ModelSelector";
import StatusBadge from "./StatusBadge";

interface Props {
  func: FunctionWithAssignment;
  providers: ProviderStatus[];
  onModelChange: (functionId: string, modelId: string) => void;
  onAddModel: () => void;
}

export default function FunctionCard({ func, providers, onModelChange, onAddModel }: Props) {
  const currentModel = AI_MODELS.find((m) => m.id === func.currentModelId);

  return (
    <div className="function-card">
      <div className="function-header">
        <h3 className="function-name">{func.name}</h3>
        {currentModel ? (
          <StatusBadge status="configured" label={currentModel.displayName} />
        ) : (
          <StatusBadge status="missing" label="No model" />
        )}
      </div>
      <p className="function-desc">{func.description}</p>
      <div className="function-controls">
        <div className="control-row">
          <label className="control-label">Model:</label>
          <ModelSelector
            func={func}
            currentModelId={func.currentModelId}
            providers={providers}
            onChange={(modelId) => onModelChange(func.id, modelId)}
          />
        </div>
        <div className="control-row">
          <span className="recommended-label">Recommended:</span>
          <span className="recommended-list">
            {func.recommendedModelIds.map((id) => {
              const m = AI_MODELS.find((x) => x.id === id);
              return m ? m.displayName : id;
            }).join(", ")}
          </span>
        </div>
        <button className="btn btn-sm btn-link" onClick={onAddModel}>
          + Add a model for this function
        </button>
      </div>
    </div>
  );
}
