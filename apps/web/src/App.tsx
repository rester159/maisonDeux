import { useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalListing } from "@luxefinder/shared";

type SearchStatus = "pending" | "processing" | "completed" | "failed";
type PollResponse = {
  search: {
    id: string;
    status: SearchStatus;
    image_analysis?: {
      brand?: string | null;
      model_name?: string | null;
      subcategory?: string | null;
      category?: string | null;
      color_primary?: string | null;
      color_secondary?: string | null;
    } | null;
    size_text?: string | null;
  };
  results: Array<{ listing: CanonicalListing }>;
  disclaimer: string;
};

function buildDetectedLine(analysis: PollResponse["search"]["image_analysis"], sizeText?: string | null): string {
  if (!analysis) return "";
  const attributes = [
    `Brand: ${analysis.brand || "Unknown brand"}`,
    `Model: ${analysis.model_name || analysis.subcategory || "unknown model"}`,
    `Category: ${analysis.category || "accessory"}`
  ];
  if (sizeText?.trim()) attributes.push(`Size: ${sizeText.trim()}`);
  const colorValue = [analysis.color_primary, analysis.color_secondary].filter(Boolean).join(", ").trim();
  if (colorValue) attributes.push(`Color: ${colorValue}`);
  return `Detected: ${attributes.join(" / ")}`;
}

export function App() {
  const [queryText, setQueryText] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready.");
  const [detected, setDetected] = useState("");
  const [results, setResults] = useState<CanonicalListing[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [sortMode, setSortMode] = useState("best");
  const [searchId, setSearchId] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  async function poll(id: string) {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      const response = await fetch(`/api/v1/search/${id}`);
      if (!response.ok) {
        setStatus("Polling failed.");
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;
        return;
      }
      const data = (await response.json()) as PollResponse;
      setResults(data.results.map((entry) => entry.listing));
      setDisclaimer(data.disclaimer || "");
      setDetected(buildDetectedLine(data.search.image_analysis, data.search.size_text));
      if (data.search.status === "completed" || data.search.status === "failed") {
        setStatus(data.search.status === "completed" ? "Search completed." : "Search failed.");
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      } else {
        setStatus("Searching marketplaces...");
      }
    }, 1500);
  }

  async function onTextSearch() {
    if (!queryText.trim()) return;
    setStatus("Starting text search...");
    setDetected("");
    const response = await fetch("/api/v1/search/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_text: queryText.trim(), category: "accessory" })
    });
    if (!response.ok) {
      setStatus("Text search failed.");
      return;
    }
    const data = (await response.json()) as { search_id: string };
    setSearchId(data.search_id);
    await poll(data.search_id);
  }

  async function onImageSearch() {
    if (!file) return;
    setStatus("Uploading image...");
    setDetected("");
    const form = new FormData();
    if (sizeText.trim()) form.append("size_text", sizeText.trim());
    form.append("image", file);
    const response = await fetch("/api/v1/search/image-upload", { method: "POST", body: form });
    if (!response.ok) {
      setStatus("Image search failed.");
      return;
    }
    const data = (await response.json()) as { search_id: string };
    setSearchId(data.search_id);
    await poll(data.search_id);
  }

  const sortedResults = useMemo(() => {
    const copy = [...results];
    if (sortMode === "low") copy.sort((a, b) => a.price_usd - b.price_usd);
    if (sortMode === "high") copy.sort((a, b) => b.price_usd - a.price_usd);
    if (sortMode === "trust") copy.sort((a, b) => b.trust_score - a.trust_score);
    return copy;
  }, [results, sortMode]);

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", color: "#f8f6ff", fontFamily: "Inter,Segoe UI,Arial,sans-serif" }}>
      <h1>maisonDeux</h1>
      <p>React web app for image-first resale search.</p>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search text..." />
          <button onClick={() => void onTextSearch()}>Search by Text</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => void onImageSearch()}>Search by Image</button>
        </div>
        <input value={sizeText} onChange={(e) => setSizeText(e.target.value)} placeholder="Optional size text" />
      </div>
      <div style={{ marginTop: 12 }}>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
          <option value="best">Sort: Best Match</option>
          <option value="low">Sort: Price Low to High</option>
          <option value="high">Sort: Price High to Low</option>
          <option value="trust">Sort: Trust Score</option>
        </select>
      </div>
      <p style={{ marginTop: 12 }}>{status}</p>
      {searchId ? <p>Search ID: {searchId}</p> : null}
      {detected ? <p>{detected}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
        {sortedResults.map((item) => (
          <article key={item.listing_id} style={{ border: "1px solid #5a4f7b", borderRadius: 10, overflow: "hidden" }}>
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.title} style={{ width: "100%", height: 200, objectFit: "cover" }} />
            ) : null}
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{item.platform}</strong>
                <strong>${Number(item.price_usd || 0).toLocaleString()}</strong>
              </div>
              <div>{item.title}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Trust {item.trust_score}/100
                {item.estimated_retail_price_usd ? ` • Retail ~$${Number(item.estimated_retail_price_usd).toLocaleString()}` : ""}
              </div>
              <a href={item.platform_listing_url} target="_blank" rel="noreferrer">
                View listing
              </a>
            </div>
          </article>
        ))}
      </div>
      {disclaimer ? <p style={{ marginTop: 16, fontSize: 12 }}>{disclaimer}</p> : null}
    </div>
  );
}
