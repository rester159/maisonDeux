import { useEffect, useState } from "react";

const API_BASE = window.location.origin;

interface Analytics {
  dau: Array<{ day: string; users: number; events: number }>;
  wau: number;
  mau: number;
  breakdown: Array<{ event_category: string; event_action: string; count: number }>;
  favStats: { total_saves?: number; users_who_saved?: number; avg_per_user?: number };
  topPlatforms: Array<{ product_platform: string; clicks: number }>;
  funnel: {
    products_detected?: number;
    searches?: number;
    deal_clicks?: number;
    favorites_saved?: number;
    condition_reports?: number;
  };
  userFunnel: Array<{ tier: string; count: number }>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/events/analytics`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p>Loading analytics...</p>;
  if (error) return <p style={{ color: "#c62828" }}>Error: {error}</p>;
  if (!data) return <p>No data available yet.</p>;

  const funnel = data.funnel || {};
  const dau = data.dau || [];
  const breakdown = data.breakdown || [];
  const topPlatforms = data.topPlatforms || [];

  // Aggregate stats.
  const totalEvents = dau.reduce((s, d) => s + Number(d.events || 0), 0);
  const totalUsers = new Set(dau.map((d) => d.day)).size; // Days with activity.
  const todayEvents = dau.find((d) => d.day === new Date().toISOString().slice(0, 10));

  return (
    <div>
      <h1 style={styles.h1}>Analytics</h1>
      <p style={styles.subtitle}>User engagement and funnel metrics (last 30 days)</p>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KpiCard label="DAU" value={todayEvents ? String(todayEvents.users) : "0"} sub="Daily Active Users" />
        <KpiCard label="WAU" value={String(data.wau || 0)} sub="Weekly Active Users" />
        <KpiCard label="MAU" value={String(data.mau || 0)} sub="Monthly Active Users" />
        <KpiCard label="Favorites" value={String(data.favStats?.total_saves || 0)} sub={`${data.favStats?.users_who_saved || 0} users saved`} />
      </div>

      {/* User Tier Funnel */}
      <section style={styles.section}>
        <h2 style={styles.h2}>User Funnel</h2>
        <div style={styles.funnel}>
          {(data.userFunnel || []).length === 0 ? (
            <p style={{ color: "#999", fontSize: 13 }}>No users registered yet.</p>
          ) : (
            <>
              {(data.userFunnel || []).map((tier) => {
                const maxCount = Math.max(...(data.userFunnel || []).map((t) => Number(t.count)));
                return (
                  <FunnelStep key={tier.tier} label={tierLabel(tier.tier)} value={Number(tier.count)} max={maxCount} />
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* Funnel */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Conversion Funnel</h2>
        <div style={styles.funnel}>
          <FunnelStep label="Products Detected" value={Number(funnel.products_detected || 0)} max={Number(funnel.products_detected || 1)} />
          <FunnelStep label="Searches Started" value={Number(funnel.searches || 0)} max={Number(funnel.products_detected || 1)} />
          <FunnelStep label="Deals Clicked" value={Number(funnel.deal_clicks || 0)} max={Number(funnel.products_detected || 1)} />
          <FunnelStep label="Favorites Saved" value={Number(funnel.favorites_saved || 0)} max={Number(funnel.products_detected || 1)} />
          <FunnelStep label="Condition Reports" value={Number(funnel.condition_reports || 0)} max={Number(funnel.products_detected || 1)} />
        </div>
      </section>

      {/* DAU Chart (simple bar) */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Daily Activity</h2>
        <div style={styles.chartContainer}>
          {dau.length === 0 ? (
            <p style={{ color: "#999", fontSize: 13 }}>No activity data yet. Events will appear as users interact with the extension.</p>
          ) : (
            <div style={styles.barChart}>
              {dau.slice(0, 14).reverse().map((d) => {
                const maxEvents = Math.max(...dau.map((x) => Number(x.events)));
                const height = maxEvents > 0 ? (Number(d.events) / maxEvents) * 120 : 0;
                return (
                  <div key={d.day} style={styles.barCol} title={`${d.day}: ${d.events} events, ${d.users} users`}>
                    <div style={{ ...styles.bar, height }} />
                    <span style={styles.barLabel}>{d.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Event Breakdown */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Event Breakdown</h2>
        {breakdown.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13 }}>No events recorded yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Count</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, i) => (
                <tr key={i}>
                  <td style={styles.td}>{row.event_category}</td>
                  <td style={styles.td}>{row.event_action}</td>
                  <td style={styles.td}>{Number(row.count).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top Platforms */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Top Platforms</h2>
        {topPlatforms.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13 }}>No platform data yet.</p>
        ) : (
          <div style={styles.platformBars}>
            {topPlatforms.map((p) => (
              <div key={p.product_platform} style={styles.platformRow}>
                <span style={{ fontSize: 12, width: 120 }}>{p.product_platform}</span>
                <div style={{ flex: 1, background: "#e8e4de", borderRadius: 4, height: 16, position: "relative" }}>
                  <div style={{
                    width: `${Math.min(100, (Number(p.clicks) / Number(topPlatforms[0].clicks)) * 100)}%`,
                    background: "#4a3728",
                    borderRadius: 4,
                    height: "100%",
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, width: 40, textAlign: "right" }}>{Number(p.clicks)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "guest": return "Guest Users (no account)";
    case "free": return "Registered (free tier)";
    case "premium": return "Premium Subscribers";
    case "admin": return "Admins";
    default: return tier;
  }
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#2c2218" }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#4a3728" }}>{label}</div>
      <div style={{ fontSize: 10, color: "#999" }}>{sub}</div>
    </div>
  );
}

function FunnelStep({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={styles.funnelStep}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: "#4a3728" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#2c2218" }}>{value.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ background: "#e8e4de", borderRadius: 4, height: 8 }}>
        <div style={{ width: `${pct}%`, background: "#4a3728", borderRadius: 4, height: "100%", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 22, fontWeight: 700, color: "#2c2218", margin: "0 0 4px" },
  subtitle: { fontSize: 13, color: "#888", marginBottom: 28 },
  h2: { fontSize: 14, fontWeight: 700, color: "#2c2218", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  section: { marginBottom: 32 },
  kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 32 },
  kpiCard: {
    background: "#fff", border: "1px solid #e8e4de", borderRadius: 8, padding: 16,
    display: "flex", flexDirection: "column", gap: 2,
  },
  funnel: { display: "flex", flexDirection: "column", gap: 8 },
  funnelStep: {},
  chartContainer: { background: "#fff", border: "1px solid #e8e4de", borderRadius: 8, padding: 16 },
  barChart: { display: "flex", alignItems: "flex-end", gap: 4, height: 140 },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  bar: { width: "100%", background: "#4a3728", borderRadius: "3px 3px 0 0", minHeight: 2 },
  barLabel: { fontSize: 9, color: "#999", marginTop: 4 },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#888", borderBottom: "2px solid #e8e4de", textTransform: "uppercase" as const },
  td: { padding: "8px 12px", fontSize: 12, borderBottom: "1px solid #f0ebe5", color: "#2c2218" },
  platformBars: { display: "flex", flexDirection: "column", gap: 6 },
  platformRow: { display: "flex", alignItems: "center", gap: 8 },
};
