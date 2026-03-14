import type { CanonicalListing } from "@luxefinder/shared";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

type SearchPollResponse = {
  search: {
    id: string;
    status: "pending" | "completed" | "failed";
    constructed_query: string | null;
    result_count: number;
  };
  results: Array<{
    relevance_score: number;
    rank_position: number;
    listing: CanonicalListing;
  }>;
  disclaimer: string;
  marketplaces_covered: number;
};

export async function startImageSearch(imageUrl: string): Promise<{ search_id: string }> {
  const response = await fetch(`${API_BASE}/api/v1/search/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl })
  });
  if (!response.ok) throw new Error("Failed to start image search");
  return response.json() as Promise<{ search_id: string }>;
}

export async function startImageUploadSearch(
  imageUri: string,
  mimeType = "image/jpeg"
): Promise<{ search_id: string }> {
  const formData = new FormData();
  formData.append(
    "image",
    {
      uri: imageUri,
      type: mimeType,
      name: "upload.jpg"
    } as any
  );
  const response = await fetch(`${API_BASE}/api/v1/search/image-upload`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) throw new Error("Failed to upload image for search");
  return response.json() as Promise<{ search_id: string }>;
}

export async function startTextSearch(queryText: string): Promise<{ search_id: string }> {
  const response = await fetch(`${API_BASE}/api/v1/search/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query_text: queryText, category: "accessory" })
  });
  if (!response.ok) throw new Error("Failed to start text search");
  return response.json() as Promise<{ search_id: string }>;
}

export async function pollSearch(searchId: string): Promise<SearchPollResponse> {
  const response = await fetch(`${API_BASE}/api/v1/search/${searchId}`);
  if (!response.ok) throw new Error("Failed to poll search");
  return response.json() as Promise<SearchPollResponse>;
}
