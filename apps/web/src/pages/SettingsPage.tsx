import { useEffect, useState } from "react";

const API_BASE = window.location.origin;

const MARKETPLACES = [
  { id: "therealreal", name: "The RealReal", url: "https://www.therealreal.com" },
  { id: "ebay", name: "eBay", url: "https://www.ebay.com" },
  { id: "poshmark", name: "Poshmark", url: "https://poshmark.com" },
  { id: "vestiaire", name: "Vestiaire Collective", url: "https://www.vestiairecollective.com" },
  { id: "grailed", name: "Grailed", url: "https://www.grailed.com" },
  { id: "mercari", name: "Mercari", url: "https://www.mercari.com" },
  { id: "shopgoodwill", name: "ShopGoodwill", url: "https://shopgoodwill.com" },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/extension-settings/default`)
      .then((r) => r.json())
      .then((data) => {
        if (data.found) setSettings(data.settings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await fetch(`${API_BASE}/api/extension-settings/default`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p>Loading settings...</p>;

  return (
    <div>
      <h1 style={styles.h1}>Settings</h1>
      <p style={styles.subtitle}>Manage API keys and preferences for MaisonDeux.</p>

      <section style={styles.section}>
        <h2 style={styles.h2}>AI Configuration</h2>
        <div style={styles.grid}>
          <Field label="Provider" value={settings.aiProvider || "openai"} onChange={(v) => setSettings({ ...settings, aiProvider: v })} type="select" options={["openai", "anthropic"]} />
          <Field label="Model" value={settings.aiModel || "gpt-4o"} onChange={(v) => setSettings({ ...settings, aiModel: v })} type="select" options={["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "claude-3-5-sonnet-20241022"]} />
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>API Keys</h2>
        <div style={styles.grid}>
          <Field label="OpenAI Key" value={settings.openaiKey || ""} onChange={(v) => setSettings({ ...settings, openaiKey: v })} secret />
          <Field label="Anthropic Key" value={settings.anthropicKey || ""} onChange={(v) => setSettings({ ...settings, anthropicKey: v })} secret />
          <Field label="eBay App ID" value={settings.ebayAppId || ""} onChange={(v) => setSettings({ ...settings, ebayAppId: v })} secret />
          <Field label="eBay Cert ID" value={settings.ebayCertId || ""} onChange={(v) => setSettings({ ...settings, ebayCertId: v })} secret />
          <Field label="SerpAPI Key" value={settings.serpapiKey || ""} onChange={(v) => setSettings({ ...settings, serpapiKey: v })} secret />
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Marketplace Status</h2>
        <div style={styles.mpList}>
          {MARKETPLACES.map((mp) => (
            <div key={mp.id} style={styles.mpRow}>
              <img src={`https://www.google.com/s2/favicons?domain=${new URL(mp.url).hostname}&sz=20`} alt="" style={{ width: 20, height: 20, borderRadius: 3 }} />
              <span style={{ flex: 1, fontSize: 13 }}>{mp.name}</span>
              <span style={{ ...styles.statusDot, background: "#4caf50" }} />
              <span style={{ fontSize: 11, color: "#4caf50" }}>Active</span>
            </div>
          ))}
        </div>
      </section>

      <button onClick={handleSave} style={styles.saveBtn}>
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", secret = false, options = [] }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; secret?: boolean; options?: string[];
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={secret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
          placeholder={secret ? "Enter key..." : ""}
        />
      )}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 22, fontWeight: 700, color: "#2c2218", margin: "0 0 4px" },
  subtitle: { fontSize: 13, color: "#888", marginBottom: 28 },
  h2: { fontSize: 14, fontWeight: 700, color: "#2c2218", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  section: { marginBottom: 32 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: "#4a3728" },
  input: {
    padding: "8px 10px", border: "1px solid #d0c8be", borderRadius: 6,
    fontSize: 13, fontFamily: "inherit", background: "#fff", outline: "none",
  },
  saveBtn: {
    padding: "10px 24px", background: "#2c2218", color: "#fff", border: "none",
    borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  mpList: { display: "flex", flexDirection: "column", gap: 2 },
  mpRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
    background: "#fff", borderRadius: 6, border: "1px solid #e8e4de",
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
};
