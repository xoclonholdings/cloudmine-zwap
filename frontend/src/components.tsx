import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]} testID="screen-header">
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  variant = "solid",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  variant?: "solid" | "outline";
}) {
  const isDisabled = disabled || loading;
  if (variant === "outline") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        testID={testID}
        style={({ pressed }) => [
          styles.btnOutline,
          isDisabled && styles.btnDisabled,
          pressed && !isDisabled && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.btnOutlineText}>{label}</Text>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [pressed && !isDisabled && { opacity: 0.85 }]}
    >
      <LinearGradient
        colors={isDisabled ? [colors.cardAlt, colors.cardAlt] : [colors.primary, colors.primaryDim]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btnSolid}
      >
        {loading ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text style={[styles.btnSolidText, isDisabled && { color: colors.textFaint }]}>
            {label}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Pill({ text, color = colors.primary }: { text: string; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function formatNum(n: number, decimals = 2): string {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (v: number) => v.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.bg,
  },
  headerTitle: { color: colors.text, fontSize: font.h1, fontWeight: "800", letterSpacing: -0.5 },
  headerSubtitle: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  btnSolid: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSolidText: { color: "#0a0a0a", fontSize: font.h3, fontWeight: "800" },
  btnOutline: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnOutlineText: { color: colors.primary, fontSize: font.h3, fontWeight: "700" },
  btnDisabled: { borderColor: colors.border },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: font.tiny, fontWeight: "700" },
});
