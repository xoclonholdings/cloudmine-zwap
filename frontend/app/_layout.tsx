import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function MineTabButton(props: any) {
  const { children, onPress, accessibilityState } = props;
  const selected = accessibilityState?.selected;

  return (
    <View style={styles.mineButtonSlot} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          styles.mineButton,
          selected && styles.mineButtonActive,
          pressed && styles.mineButtonPressed,
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}

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
          initialRouteName="index"
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
            tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          }}
        >
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
            name="index"
            options={{
              title: "Mine",
              tabBarButton: (props) => <MineTabButton {...props} />,
              tabBarIcon: ({ color }) => (
                <Ionicons name="hardware-chip" size={27} color={color} />
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
        </Tabs>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  mineButtonSlot: {
    flex: 1,
    alignItems: "center",
  },
  mineButton: {
    width: 76,
    minHeight: 62,
    marginTop: -22,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mineButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  mineButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
});
