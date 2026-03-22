import type { KeyStatus, FunctionWithAssignment, ProviderStatus } from "./types";

const BASE = "/dev-admin";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Keys ----

export function fetchKeys(): Promise<KeyStatus[]> {
  return json(`${BASE}/keys`);
}

export function updateKey(keyName: string, value: string): Promise<{ ok: boolean }> {
  return json(`${BASE}/keys/${keyName}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

export function validateKey(keyName: string): Promise<{ valid: boolean; error?: string }> {
  return json(`${BASE}/keys/${keyName}/validate`, { method: "POST" });
}

// ---- Functions ----

export function fetchFunctions(): Promise<FunctionWithAssignment[]> {
  return json(`${BASE}/functions`);
}

export function assignModel(functionId: string, modelId: string): Promise<{ ok: boolean }> {
  return json(`${BASE}/functions/${functionId}/model`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
}

// ---- Providers ----

export function fetchProviders(): Promise<ProviderStatus[]> {
  return json(`${BASE}/providers`);
}
