import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CanonicalListing } from "@luxefinder/shared";
import { pollSearch } from "../api";
import { useMaisonDeuxStore } from "../store";

type RootStackParamList = {
  Home: undefined;
  Results: undefined;
  ListingDetail: { listingId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

const FILTERS = ["All", "Fashion", "Watches", "Jewelry", "Price", "Condition", "Marketplace", "Verified Only"];

export function ResultsScreen({ navigation }: Props) {
  const { currentSearchId, query, listings, setListings, disclaimer } = useMaisonDeuxStore();
  const [status, setStatus] = useState<"pending" | "completed" | "failed">("pending");
  const [sortMode, setSortMode] = useState<"best" | "low" | "high">("best");

  useEffect(() => {
    if (!currentSearchId) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const data = await pollSearch(currentSearchId);
        if (!active) return;
        setStatus(data.search.status);
        setListings(
          data.results
            .map((result) => result.listing)
            .filter((listing): listing is CanonicalListing => Boolean(listing)),
          data.disclaimer
        );
      } catch {
        if (!active) return;
        setStatus("failed");
      }
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [currentSearchId, setListings]);

  const sorted = useMemo(() => {
    const copy = [...listings];
    if (sortMode === "low") return copy.sort((a, b) => a.price_usd - b.price_usd);
    if (sortMode === "high") return copy.sort((a, b) => b.price_usd - a.price_usd);
    return copy.sort((a, b) => b.trust_score - a.trust_score);
  }, [listings, sortMode]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{query || "Search"} results</Text>
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.pill}>
            <Text>{item}</Text>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />
      <View style={styles.sortRow}>
        <Text>{`${sorted.length} listings`}</Text>
        <View style={styles.sortButtons}>
          <Pressable style={styles.sortButton} onPress={() => setSortMode("best")}>
            <Text>Best</Text>
          </Pressable>
          <Pressable style={styles.sortButton} onPress={() => setSortMode("low")}>
            <Text>Low-High</Text>
          </Pressable>
          <Pressable style={styles.sortButton} onPress={() => setSortMode("high")}>
            <Text>High-Low</Text>
          </Pressable>
        </View>
      </View>
      {status === "pending" && listings.length === 0 ? <ActivityIndicator size="large" /> : null}
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.listing_id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("ListingDetail", { listingId: item.listing_id })}
          >
            <Text style={styles.platform}>{item.platform.toUpperCase()}</Text>
            <Text style={styles.price}>${item.price_usd.toLocaleString()}</Text>
            <Text numberOfLines={2}>{item.title}</Text>
            <Text style={styles.meta}>{`Condition: ${item.condition}`}</Text>
            <Text style={styles.meta}>{`Trust ${item.trust_score}/100`}</Text>
          </Pressable>
        )}
      />
      {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  header: { fontWeight: "700", fontSize: 20 },
  pill: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sortButtons: { flexDirection: "row", gap: 6 },
  sortButton: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  grid: { gap: 8, paddingBottom: 50 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    minHeight: 130
  },
  platform: { fontWeight: "700", color: "#111827", marginBottom: 4 },
  price: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  meta: { color: "#374151", fontSize: 12 },
  disclaimer: { marginTop: 8, fontSize: 11, color: "#4b5563" }
});
