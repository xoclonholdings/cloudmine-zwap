import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { colors } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarStyle: {
              backgroundColor: colors.bgElevated,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: Platform.OS === "ios" ? 88 : 68,
              paddingTop: 8,
              paddingBottom: Platform.OS === "ios" ? 28 : 10,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Mine",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="hardware-chip" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="swap"
            options={{
              title: "Swap",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="swap-horizontal" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="withdraw"
            options={{
              title: "Withdraw",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="arrow-up-circle" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: "Activity",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="receipt" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
