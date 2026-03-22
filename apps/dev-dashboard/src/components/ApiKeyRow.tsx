import React, { useState } from "react";
import type { KeyStatus } from "../types";
import { updateKey, validateKey } from "../api";
import StatusBadge from "./StatusBadge";

interface Props {
  keySlot: KeyStatus & { label: string };
  onUpdated: () => void;
}

export default function ApiKeyRow({ keySlot, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await updateKey(keySlot.name, value.trim());
      setEditing(false);
      setValue("");
      setValidationResult(null);
      onUpdated();
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateKey(keySlot.name);
      setValidationResult(result);
    } catch (e: any) {
      setValidationResult({ valid: false, error: e.message });
    } finally {
      setValidating(false);
    }
  }

  return (
    <tr className="key-row">
      <td className="key-label">{keySlot.label}</td>
      <td className="key-env"><code>{keySlot.envVar}</code></td>
      <td>
        <StatusBadge status={keySlot.configured ? "configured" : "missing"} />
      </td>
      <td className="key-masked">
        {keySlot.maskedValue ? `****${keySlot.maskedValue}` : "—"}
      </td>
      <td className="key-actions">
        {editing ? (
          <span className="edit-row">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter key..."
              className="key-input"
              autoFocus
            />
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "..." : "Save"}
            </button>
            <button className="btn btn-sm" onClick={() => { setEditing(false); setValue(""); }}>
              Cancel
            </button>
          </span>
        ) : (
          <span className="action-btns">
            <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>
            {keySlot.configured && (
              <button className="btn btn-sm" onClick={handleValidate} disabled={validating}>
                {validating ? "..." : "Validate"}
              </button>
            )}
          </span>
        )}
        {validationResult && (
          <span style={{ marginLeft: 8 }}>
            <StatusBadge
              status={validationResult.valid ? "valid" : "invalid"}
              label={validationResult.valid ? "Valid" : validationResult.error || "Invalid"}
            />
          </span>
        )}
      </td>
    </tr>
  );
}
