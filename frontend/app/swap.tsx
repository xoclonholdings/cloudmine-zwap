import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api, Asset, SwapQuote, UserState } from "@/src/api";
import { bgGradient, colors, ctaGradient, font, radius, spacing } from "@/src/theme";
import { formatNum } from "@/src/components";

export default function SwapScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserState | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, assetData] = await Promise.all([api.me(), api.swapAssets()]);
      setUser(me);
      setAssets(assetData.assets);
      if (!assetData.assets.some((asset) => asset.symbol === selected) && assetData.assets[0]) {
        setSelected(assetData.assets[0].symbol);
      }
    } catch (error: any) {
      Alert.alert("Unable to load Swap", error?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    setQuote(null);
  }, [amount, selected]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.symbol === selected),
    [assets, selected]
  );

  const numericAmount = Number(amount || 0);
  const canQuote = numericAmount > 0 && numericAmount <= (user?.zwap_balance ?? 0);

  const requestQuote = async () => {
    if (!canQuote) return;
    setBusy(true);
    try {
      const result = await api.swapQuote(numericAmount, selected);
      setQuote(result);
      Haptics.selectionAsync();
    } catch (error: any) {
      Alert.alert("Quote unavailable", error?.message || "Please try another amount or asset.");
    } finally {
      setBusy(false);
    }
  };

  const executeSwap = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const updated = await api.swapExecute(numericAmount, selected);
      setUser(updated);
      setAmount("");
      setQuote(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Swap complete", `Your ${selected} balance has been updated.`);
    } catch (error: any) {
      Alert.alert("Swap failed", error?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MINESWAP</Text>
            <Text style={styles.title}>Swap</Text>
          </View>
          <View style={styles.networkPill}>
            <View style={styles.networkDot} />
            <Text style={styles.networkText}>Ethereum ZWAP</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.label}>Available to swap</Text>
          <View style={styles.balanceRow}>
            <View style={styles.zBadge}>
              <Text style={styles.zBadgeText}>Z</Text>
            </View>
            <Text style={styles.balance}>{formatNum(user?.zwap_balance ?? 0, 4)}</Text>
            <Text style={styles.symbol}>ZWAP</Text>
          </View>
          <Text style={styles.contractText}>Ethereum · 0x567c…55f0</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>You swap</Text>
          <View style={styles.amountRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              testID="swap-amount"
            />
            <View style={styles.tokenPill}>
              <Text style={styles.tokenPillText}>ZWAP</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setAmount(String(user?.zwap_balance ?? 0))}
            style={styles.maxButton}
          >
            <Text style={styles.maxButtonText}>MAX</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>You receive</Text>
          <View style={styles.assetRow}>
            {assets.map((asset) => {
              const active = asset.symbol === selected;
              return (
                <Pressable
                  key={asset.symbol}
                  onPress={() => setSelected(asset.symbol)}
                  style={[styles.assetButton, active && styles.assetButtonActive]}
                >
                  <Text style={[styles.assetSymbol, active && styles.assetSymbolActive]}>
                    {asset.symbol}
                  </Text>
                  <Text style={styles.assetNetwork}>{asset.network}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedAsset && (
            <View style={styles.routeRow}>
              <Ionicons name="git-branch-outline" size={17} color={colors.primary} />
              <Text style={styles.routeText}>
                ZWAP on Ethereum → {selectedAsset.name} on {selectedAsset.network}
              </Text>
            </View>
          )}

          {quote && (
            <View style={styles.quoteCard}>
              <View style={styles.quoteLine}>
                <Text style={styles.quoteLabel}>Estimated receive</Text>
                <Text style={styles.quoteValue}>{quote.dest_amount} {quote.to_symbol}</Text>
              </View>
              <View style={styles.quoteLine}>
                <Text style={styles.quoteLabel}>Route</Text>
                <Text style={styles.quoteValue}>{quote.network}</Text>
              </View>
              <View style={styles.quoteLine}>
                <Text style={styles.quoteLabel}>Fee</Text>
                <Text style={styles.quoteValue}>{(quote.fee_pct * 100).toFixed(2)}%</Text>
              </View>
              <Text style={styles.rateText}>{quote.rate}</Text>
            </View>
          )}

          {quote ? (
            <Pressable onPress={executeSwap} disabled={busy} testID="confirm-swap-button">
              <LinearGradient colors={ctaGradient} style={styles.cta}>
                {busy ? (
                  <ActivityIndicator color="#08130E" />
                ) : (
                  <Text style={styles.ctaText}>Confirm Swap</Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={requestQuote} disabled={!canQuote || busy || loading} testID="get-quote-button">
              <LinearGradient
                colors={canQuote ? ctaGradient : [colors.cardAlt, colors.cardAlt]}
                style={styles.cta}
              >
                {busy || loading ? (
                  <ActivityIndicator color={canQuote ? "#08130E" : colors.textFaint} />
                ) : (
                  <Text style={[styles.ctaText, !canQuote && styles.ctaTextDisabled]}>Review Swap</Text>
                )}
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <Text style={styles.noticeText}>
            MineSwap's source token is the Ethereum ZWAP deployment. The separate Polygon ZWAP deployment is not merged into this balance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: font.tiny, fontWeight: "800", letterSpacing: 2 },
  title: { color: colors.text, fontSize: font.h1, fontWeight: "900", marginTop: 2 },
  networkPill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  networkText: { color: colors.textDim, fontSize: font.tiny, fontWeight: "700" },
  balanceCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  label: { color: colors.textDim, fontSize: font.small },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
  zBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  zBadgeText: { color: "#fff", fontWeight: "900" },
  balance: { color: colors.text, fontSize: 28, fontWeight: "900" },
  symbol: { color: colors.textDim, fontSize: font.body, fontWeight: "800" },
  contractText: { color: colors.textFaint, fontSize: font.tiny, marginTop: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg, padding: spacing.md },
  sectionTitle: { color: colors.textDim, fontSize: font.small, fontWeight: "700", marginBottom: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amountInput: { flex: 1, color: colors.text, fontSize: 34, fontWeight: "800", paddingVertical: 8 },
  tokenPill: { borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  tokenPillText: { color: colors.text, fontWeight: "800" },
  maxButton: { alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.primary + "18" },
  maxButtonText: { color: colors.primary, fontSize: font.tiny, fontWeight: "900" },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  assetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  assetButton: { minWidth: 74, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated, paddingHorizontal: 12, paddingVertical: 10 },
  assetButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
  assetSymbol: { color: colors.textDim, fontSize: font.body, fontWeight: "900" },
  assetSymbolActive: { color: colors.primary },
  assetNetwork: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, padding: 12, borderRadius: radius.md, backgroundColor: colors.bgElevated },
  routeText: { flex: 1, color: colors.textDim, fontSize: font.small, lineHeight: 18 },
  quoteCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated },
  quoteLine: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  quoteLabel: { color: colors.textDim, fontSize: font.small },
  quoteValue: { color: colors.text, fontSize: font.small, fontWeight: "800" },
  rateText: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  cta: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  ctaText: { color: "#08130E", fontWeight: "900", fontSize: font.body },
  ctaTextDisabled: { color: colors.textFaint },
  notice: { flexDirection: "row", gap: 10, padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft },
  noticeText: { flex: 1, color: colors.textDim, fontSize: font.small, lineHeight: 19 },
});
