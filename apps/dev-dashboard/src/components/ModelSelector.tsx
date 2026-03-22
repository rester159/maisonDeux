import React from "react";
import { AI_MODELS, type AIFunction, type ProviderStatus } from "../types";

interface Props {
  func: AIFunction;
  currentModelId: string | null;
  providers: ProviderStatus[];
  onChange: (modelId: string) => void;
}

export default function ModelSelector({ func, currentModelId, providers, onChange }: Props) {
  const configuredProviders = new Set(
    providers.filter((p) => p.configured).map((p) => p.provider)
  );

  // Only show models whose provider has a key and whose capabilities meet requirements.
  const available = AI_MODELS.filter((m) => {
    const hasKey = configuredProviders.has(m.provider);
    const hasCapabilities = func.requiredCapabilities.every((c) =>
      m.capabilities.includes(c)
    );
    return hasKey && hasCapabilities;
  });

  const isRecommended = (id: string) => func.recommendedModelIds.includes(id);

  return (
    <select
      className="model-select"
      value={currentModelId ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Not assigned —</option>
      {available.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName} ({m.costTier}){isRecommended(m.id) ? " *" : ""}
        </option>
      ))}
    </select>
  );
}
