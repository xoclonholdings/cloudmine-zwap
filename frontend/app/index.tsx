import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font, bgGradient, glowGradient, ctaGradient } from "@/src/theme";
import { api, UserState } from "@/src/api";
import { formatNum, formatCountdown } from "@/src/components";

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserState | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pending, setPending] = useState(0);

  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
      setCountdown(u.mine.seconds_left);
      setPending(u.mine.pending);
    } catch (e) {
      // silent — offline safe
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const poll = setInterval(load, 5000);
      return () => clearInterval(poll);
    }, [load])
  );

  // local per-second countdown + pending accrual (visual smoothness)
  useEffect(() => {
    if (!user?.mine.active) return;
    const t = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
      setPending((p) => p + user.mine.rate_per_hour / 3600);
    }, 1000);
    return () => clearInterval(t);
  }, [user?.mine.active, user?.mine.rate_per_hour]);

  // animations
  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    p.start();
    return () => p.stop();
  }, [pulse]);

  useEffect(() => {
    if (user?.mine.active) {
      const s = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
      );
      s.start();
      return () => s.stop();
    }
  }, [user?.mine.active, spin]);

  const onStart = async () => {
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.mineStart();
      await load();
    } catch (e) {}
    setBusy(false);
  };

  const onClaim = async () => {
    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const u = await api.mineClaim();
      setUser(u);
      setCountdown(u.mine.seconds_left);
      setPending(u.mine.pending);
    } catch (e) {}
    setBusy(false);
  };

  const active = user?.mine.active ?? false;
  const canClaim = pending > 0.0001;
  const ths = active ? (user!.mine.rate_per_hour / 24).toFixed(1) : "0";

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Top bar */}
        <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.iconBtn} testID="menu-button">
            <Ionicons name="menu" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.balancePill} testID="balance-pill">
            <View style={styles.zBadge}>
              <Text style={styles.zBadgeText}>Z</Text>
            </View>
            <Text style={styles.balancePillText} testID="zwap-balance">
              {formatNum(user?.zwap_balance ?? 0, 4)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable style={styles.iconBtn} testID="gift-button">
              <Ionicons name="gift-outline" size={22} color={colors.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} testID="bell-button">
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Miner card */}
        <View style={styles.minerCardWrap}>
          <LinearGradient
            colors={glowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.minerCard}
          >
            {/* status chips */}
            <View style={styles.chipsRow}>
              <View style={styles.statusChip}>
                <View style={[styles.dot, { backgroundColor: active ? colors.primary : colors.textFaint }]} />
                <Text style={styles.statusChipText}>Active {active ? 1 : 0}</Text>
              </View>
              <View style={styles.chipRight}>
                <View style={styles.roundChip}>
                  <Ionicons name="help" size={16} color={colors.textDim} />
                </View>
                <View style={styles.roundChip}>
                  <Ionicons name="document-text-outline" size={15} color={colors.textDim} />
                </View>
                <View style={styles.thsChip}>
                  <Ionicons name="flash" size={14} color={colors.primary} />
                  <Text style={styles.thsText}>{ths} TH/S</Text>
                </View>
              </View>
            </View>

            {/* pedestal + rig */}
            <View style={styles.rigArea}>
              <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
              <View style={styles.pedestalOuter}>
                <View style={styles.pedestalMid}>
                  <Animated.View style={[styles.pedestalInner, { transform: [{ scale }] }]}>
                    <Animated.View style={active ? { transform: [{ rotate }] } : undefined}>
                      <Ionicons name="hardware-chip" size={78} color={colors.text} />
                    </Animated.View>
                  </Animated.View>
                </View>
              </View>
              <Text style={styles.rigLabel}>ZWAP MINER</Text>
            </View>

            {/* pending amount */}
            <View style={styles.pendingRow}>
              <View style={styles.btcCoin}>
                <Ionicons name="logo-bitcoin" size={20} color="#fff" />
              </View>
              <Text style={styles.pendingText} testID="pending-amount">
                {pending.toFixed(6)}
              </Text>
              <View style={styles.rocket}>
                <Ionicons name="rocket" size={18} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.pendingLabel}>Unclaimed ZWAP</Text>

            {/* CTA */}
            {active ? (
              <Pressable onPress={onClaim} disabled={busy || !canClaim} testID="claim-button">
                <LinearGradient
                  colors={canClaim ? ctaGradient : [colors.cardAlt, colors.cardAlt]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  <Text style={[styles.ctaText, !canClaim && { color: colors.textFaint }]}>
                    {busy ? "..." : canClaim ? `Claim ${pending.toFixed(4)} ZWAP` : "Mining..."}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={onStart} disabled={busy} testID="start-mining-button">
                <LinearGradient colors={ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                  <Text style={styles.ctaText}>{busy ? "Starting..." : "Start Mining"}</Text>
                </LinearGradient>
              </Pressable>
            )}

            {active && (
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={15} color={colors.textDim} />
                <Text style={styles.countdownText}>Session ends in {formatCountdown(countdown)}</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Mined</Text>
            <Text style={styles.statValue} testID="total-mined">{formatNum(user?.total_mined ?? 0, 2)}</Text>
            <Text style={styles.statUnit}>ZWAP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Est. Value</Text>
            <Text style={styles.statValue}>${formatNum(user?.zwap_usd ?? 0, 2)}</Text>
            <Text style={styles.statUnit}>USD</Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Mine · Swap · Withdraw</Text>
            <Text style={styles.bannerText}>
              Rewards are server-validated (simulated). Swap ZWAP to BTC, ETH, USDC or POL, then withdraw.
            </Text>
          </View>
          <Ionicons name="sparkles" size={26} color={colors.primary} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  zBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.btc,
    alignItems: "center",
    justifyContent: "center",
  },
  zBadgeText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  balancePillText: { color: colors.text, fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  minerCardWrap: { paddingHorizontal: spacing.md },
  minerCard: {
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.accent + "77",
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  chipsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg + "88",
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { color: colors.text, fontWeight: "700", fontSize: font.body },
  chipRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg + "55",
  },
  thsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.bg + "55",
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thsText: { color: colors.text, fontWeight: "700", fontSize: font.small },

  rigArea: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg },
  glowRing: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.accent,
  },
  pedestalOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentDim + "33",
    borderWidth: 2,
    borderColor: colors.accent + "66",
    alignItems: "center",
    justifyContent: "center",
  },
  pedestalMid: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.accentDim + "55",
    borderWidth: 2,
    borderColor: colors.primary + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  pedestalInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rigLabel: {
    color: colors.textDim,
    fontWeight: "800",
    letterSpacing: 3,
    fontSize: font.tiny,
    marginTop: spacing.md,
  },

  pendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  btcCoin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.btc,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingText: { color: colors.text, fontWeight: "900", fontSize: 30, letterSpacing: -1 },
  rocket: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryDim + "33",
    borderWidth: 1,
    borderColor: colors.primary + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingLabel: { color: colors.textDim, textAlign: "center", fontSize: font.small, marginTop: 4, marginBottom: spacing.md },

  cta: { height: 58, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#08130E", fontWeight: "900", fontSize: font.h2 },
  countdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  countdownText: { color: colors.textDim, fontSize: font.small, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  statLabel: { color: colors.textDim, fontSize: font.small },
  statValue: { color: colors.text, fontSize: font.h2, fontWeight: "800", marginTop: 4 },
  statUnit: { color: colors.textFaint, fontSize: font.tiny, fontWeight: "700", marginTop: 2 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  bannerTitle: { color: colors.text, fontWeight: "800", fontSize: font.body },
  bannerText: { color: colors.textDim, fontSize: font.small, marginTop: 4, lineHeight: 18 },
});
