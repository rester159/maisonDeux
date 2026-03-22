import React, { useState } from "react";
import type { AIProvider } from "../types";
import { updateKey } from "../api";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const PROVIDER_KEY_MAP: Record<AIProvider, { envVar: string; keyName: string; label: string }> = {
  openai:    { envVar: "OPENAI_API_KEY",    keyName: "openai",    label: "OpenAI" },
  anthropic: { envVar: "ANTHROPIC_API_KEY", keyName: "anthropic", label: "Anthropic" },
  google:    { envVar: "GOOGLE_AI_API_KEY", keyName: "google_ai", label: "Google AI" },
};

export default function AddModelDialog({ onClose, onSaved }: Props) {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const info = PROVIDER_KEY_MAP[provider];
      await updateKey(info.keyName, apiKey.trim());
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Add AI Provider Key</h3>
        <label className="field-label">
          Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)} className="model-select">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google AI</option>
          </select>
        </label>
        <label className="field-label">
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter ${PROVIDER_KEY_MAP[provider].label} API key...`}
            className="key-input"
            autoFocus
          />
        </label>
        <p className="hint">Will be saved to <code>{PROVIDER_KEY_MAP[provider].envVar}</code></p>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !apiKey.trim()}>
            {saving ? "Saving..." : "Save Key"}
          </button>
        </div>
      </div>
    </div>
  );
}
