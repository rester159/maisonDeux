import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { startImageUploadSearch, startTextSearch } from "../api";
import { useLuxeFinderStore } from "../store";

type RootStackParamList = {
  Home: undefined;
  Results: undefined;
  ListingDetail: { listingId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const TRENDING = ["Rolex", "Chanel", "Cartier", "Hermes", "Patek Philippe", "Van Cleef", "Gucci"];

export function HomeScreen({ navigation }: Props) {
  const [textQuery, setTextQuery] = useState("");
  const { setSearch } = useLuxeFinderStore();

  async function onTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera required", "Please grant camera permission.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets.length) return;
    try {
      const asset = result.assets[0];
      const search = await startImageUploadSearch(asset.uri, asset.mimeType ?? "image/jpeg");
      setSearch(search.search_id, "Image search");
      navigation.navigate("Results");
    } catch {
      Alert.alert("Upload failed", "Could not upload image for search. Please try again.");
    }
  }

  async function onPickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets.length) return;
    try {
      const asset = result.assets[0];
      const search = await startImageUploadSearch(asset.uri, asset.mimeType ?? "image/jpeg");
      setSearch(search.search_id, "Image search");
      navigation.navigate("Results");
    } catch {
      Alert.alert("Upload failed", "Could not upload image for search. Please try again.");
    }
  }

  async function onTextSearch() {
    if (!textQuery.trim()) return;
    const search = await startTextSearch(textQuery.trim());
    setSearch(search.search_id, textQuery.trim());
    navigation.navigate("Results");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>LuxeFinder</Text>
      <Text style={styles.subtitle}>Upload a photo to search everywhere</Text>
      <View style={styles.uploadZone}>
        <Text style={styles.uploadText}>Luxury item image search</Text>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={onTakePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onPickLibrary}>
          <Text style={styles.buttonText}>Choose from Library</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Or search by brand, model, name..."
        value={textQuery}
        onChangeText={setTextQuery}
      />
      <Pressable style={styles.searchButton} onPress={onTextSearch}>
        <Text style={styles.buttonText}>Search</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>Trending brands</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TRENDING.map((brand) => (
          <Pressable key={brand} style={styles.pill} onPress={() => setTextQuery(brand)}>
            <Text>{brand}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#666" },
  uploadZone: {
    borderWidth: 2,
    borderColor: "#bbb",
    borderStyle: "dashed",
    borderRadius: 12,
    height: 160,
    alignItems: "center",
    justifyContent: "center"
  },
  uploadText: { fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  searchButton: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: { color: "white", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 6 },
  pill: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  }
});
