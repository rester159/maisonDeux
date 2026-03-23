import { useEffect, useState } from "react";

const STORE_NAMES: Record<string, string> = {
  ebay: "eBay", therealreal: "TheRealReal", poshmark: "Poshmark",
  vestiaire: "Vestiaire", grailed: "Grailed", mercari: "Mercari",
  shopgoodwill: "ShopGoodwill",
};

interface FavItem {
  title: string; brand: string; price: string | number; currency: string;
  platform: string; link: string; img: string; color: string;
  material: string; model: string; condition: string;
  _conditionReport?: { overallGrade?: string };
}

export function ComparePage() {
  const [items, setItems] = useState<FavItem[]>([]);

  useEffect(() => {
    // Read from URL params (extension passes data via query string or localStorage).
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get("data");
    if (dataParam) {
      try { setItems(JSON.parse(decodeURIComponent(dataParam))); } catch {}
    } else {
      // Try localStorage fallback.
      try {
        const stored = localStorage.getItem("maisondeux_compare");
        if (stored) setItems(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const prices = items.map((i) => parseFloat(String(i.price || "").replace(/[^0-9.]/g, "")) || 0).filter((p) => p > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={styles.h1}>Deep Comparison</h1>
          <p style={styles.subtitle}>Side-by-side comparison of {items.length} saved items</p>
        </div>
        <button onClick={() => window.print()} style={styles.printBtn}>Print</button>
      </div>

      {items.length === 0 ? (
        <div style={styles.empty}>
          <p>No items to compare.</p>
          <p style={{ fontSize: 13, color: "#999" }}>Save items from the Chrome extension, then click "Compare All" in the favorites view.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["", "Title", "Brand", "Model", "Price", "vs. Lowest", "Store", "Color", "Material", "Condition", "AI Grade", "Link"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const price = parseFloat(String(item.price || "").replace(/[^0-9.]/g, "")) || 0;
                const delta = price > 0 && lowestPrice > 0 ? price - lowestPrice : 0;
                const store = STORE_NAMES[item.platform] || item.platform || "";
                const aiGrade = item._conditionReport?.overallGrade || "";
                const gradeClass = ["New", "Excellent"].includes(aiGrade) ? "#2e7d32" : ["Very Good", "Good"].includes(aiGrade) ? "#f57f17" : aiGrade ? "#c62828" : "#ccc";

                return (
                  <tr key={i} style={{ borderBottom: "1px solid #e8e4de" }}>
                    <td style={styles.td}>{item.img ? <img src={item.img} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover" }} /> : null}</td>
                    <td style={{ ...styles.td, maxWidth: 200 }}>{item.title}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{item.brand}</td>
                    <td style={styles.td}>{item.model}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{price > 0 ? `$${price.toLocaleString()}` : "—"}</td>
                    <td style={styles.td}>
                      {delta === 0 && price > 0 ? <span style={{ color: "#2e7d32", fontWeight: 600 }}>Lowest</span> : delta > 0 ? <span style={{ color: "#c62828" }}>+${Math.round(delta).toLocaleString()}</span> : "—"}
                    </td>
                    <td style={styles.td}><span style={styles.chip}>{store}</span></td>
                    <td style={styles.td}>{item.color || "—"}</td>
                    <td style={styles.td}>{item.material || "—"}</td>
                    <td style={styles.td}>{item.condition || "—"}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: gradeClass }}>{aiGrade || "—"}</td>
                    <td style={styles.td}>{item.link ? <a href={item.link} target="_blank" rel="noopener" style={{ color: "#1565c0", textDecoration: "none" }}>View</a> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 22, fontWeight: 700, color: "#2c2218", margin: 0 },
  subtitle: { fontSize: 13, color: "#888" },
  printBtn: { padding: "8px 16px", background: "#2c2218", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  empty: { textAlign: "center", padding: 48, color: "#666" },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 800 },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#fff", background: "#2c2218", whiteSpace: "nowrap" as const, textTransform: "uppercase" as const },
  td: { padding: "8px 12px", fontSize: 12, verticalAlign: "middle" as const },
  chip: { display: "inline-block", padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600, background: "#f0ebe5", color: "#6b5b4e" },
};
