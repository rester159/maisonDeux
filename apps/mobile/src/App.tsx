import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeScreen } from "./screens/HomeScreen";
import { ListingDetailScreen } from "./screens/ListingDetailScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import {
  OnboardingScreen,
  PriceAlertSetupScreen,
  ProfileScreen,
  SavedSearchesScreen,
  SearchHistoryScreen
} from "./screens/UtilityScreens";

type RootStackParamList = {
  Home: undefined;
  Results: undefined;
  ListingDetail: { listingId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();
const queryClient = new QueryClient();

function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: "Listing Detail" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Tabs.Navigator screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="Search" component={SearchStack} />
          <Tabs.Screen name="Saved" component={SavedSearchesScreen} />
          <Tabs.Screen name="History" component={SearchHistoryScreen} />
          <Tabs.Screen name="Alerts" component={PriceAlertSetupScreen} />
          <Tabs.Screen name="Profile" component={ProfileScreen} />
          <Tabs.Screen name="Onboarding" component={OnboardingScreen} />
        </Tabs.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
