import type { CanonicalListing } from "@luxefinder/shared";
import { create } from "zustand";

type LuxeFinderState = {
  currentSearchId: string | null;
  query: string;
  listings: CanonicalListing[];
  disclaimer: string;
  setSearch: (searchId: string, query: string) => void;
  setListings: (listings: CanonicalListing[], disclaimer: string) => void;
};

export const useLuxeFinderStore = create<LuxeFinderState>((set) => ({
  currentSearchId: null,
  query: "",
  listings: [],
  disclaimer: "",
  setSearch: (searchId, query) => set({ currentSearchId: searchId, query }),
  setListings: (listings, disclaimer) => set({ listings, disclaimer })
}));
