import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMaisonDeuxStore } from "../store";

type RootStackParamList = {
  Home: undefined;
  Results: undefined;
  ListingDetail: { listingId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "ListingDetail">;

export function ListingDetailScreen({ route }: Props) {
  const { listingId } = route.params;
  const listing = useMaisonDeuxStore((state) => state.listings.find((item) => item.listing_id === listingId));

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text>Listing not found</Text>
      </View>
    );
  }

  const authColor =
    listing.authentication_status === "platform_authenticated"
      ? "#16a34a"
      : listing.authentication_status === "seller_claimed"
        ? "#eab308"
        : "#6b7280";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.platform}>{`Listed on ${listing.platform}`}</Text>
      <Text style={styles.price}>${listing.price_usd.toLocaleString()}</Text>
      <View style={[styles.authBanner, { backgroundColor: authColor }]}>
        <Text style={styles.authText}>{listing.authentication_status.replace(/_/g, " ").toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.text}>{listing.description}</Text>
      <Text style={styles.meta}>{`Condition: ${listing.condition} (${listing.condition_raw})`}</Text>
      <Text style={styles.meta}>{`Brand: ${listing.brand}`}</Text>
      <Text style={styles.meta}>{`Category: ${listing.category}`}</Text>
      <Text style={styles.meta}>{`Material: ${listing.material ?? "Unknown"}`}</Text>
      <Text style={styles.meta}>{`Seller rating: ${listing.seller_rating ?? "N/A"}`}</Text>
      <Text style={styles.meta}>{`Location: ${listing.location_country ?? "N/A"}`}</Text>
      <Pressable style={styles.button} onPress={() => Linking.openURL(listing.platform_listing_url)}>
        <Text style={styles.buttonText}>{`View on ${listing.platform}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  platform: { color: "#374151", fontWeight: "600" },
  price: { fontSize: 34, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "700" },
  text: { color: "#4b5563", lineHeight: 20 },
  meta: { color: "#111827" },
  authBanner: { borderRadius: 10, padding: 8, alignSelf: "flex-start" },
  authText: { color: "white", fontWeight: "700" },
  button: {
    marginTop: 8,
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    alignItems: "center"
  },
  buttonText: { color: "white", fontWeight: "700" }
});
