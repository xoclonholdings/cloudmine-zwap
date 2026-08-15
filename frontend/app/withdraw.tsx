import React, { useCallback, useMemo, useState } from "react";
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

import { api, Asset, UserState } from "@/src/api";
import { bgGradient, colors, ctaGradient, font, radius, spacing } from "@/src/theme";
import { formatNum } from "@/src/components";

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserState | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
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
      Alert.alert("Unable to load Withdraw", error?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.symbol === selected),
    [assets, selected]
  );

  const available = user?.assets?.[selected] ?? 0;
  const numericAmount = Number(amount || 0);
  const canSubmit =
    !!selectedAsset &&
    address.trim().length >= 8 &&
    numericAmount >= selectedAsset.min_withdraw &&
    numericAmount <= available;

  const submit = async () => {
    if (!selectedAsset || !canSubmit) return;

    Alert.alert(
      "Confirm withdrawal",
      `${numericAmount} ${selected} to ${address.trim()} on ${selectedAsset.network}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "default",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await api.withdraw(selected, numericAmount, address.trim());
              setUser(result.user);
              setAmount("");
              setAddress("");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Withdrawal submitted",
                `${result.delivered} ${selected} after fee. Network: ${result.network}.`
              );
            } catch (error: any) {
              Alert.alert("Withdrawal failed", error?.message || "Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MINESWAP</Text>
            <Text style={styles.title}>Withdraw</Text>
          </View>
          <View style={styles.securePill}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={styles.secureText}>Network aware</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose asset</Text>
          <View style={styles.assetRow}>
            {assets.map((asset) => {
              const active = asset.symbol === selected;
              const balance = user?.assets?.[asset.symbol] ?? 0;
              return (
                <Pressable
                  key={asset.symbol}
                  onPress={() => {
                    setSelected(asset.symbol);
                    setAmount("");
                  }}
                  style={[styles.assetButton, active && styles.assetButtonActive]}
                >
                  <Text style={[styles.assetSymbol, active && styles.assetSymbolActive]}>{asset.symbol}</Text>
                  <Text style={styles.assetBalance}>{formatNum(balance, asset.decimals)} available</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedAsset && (
          <View style={styles.card}>
            <View style={styles.networkRow}>
              <View>
                <Text style={styles.sectionTitle}>Network</Text>
                <Text style={styles.networkName}>{selectedAsset.network}</Text>
              </View>
              <Ionicons name="git-network-outline" size={23} color={colors.accent} />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Destination address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={`Enter ${selectedAsset.network} address`}
              placeholderTextColor={colors.textFaint}
              style={styles.addressInput}
              testID="withdraw-address"
            />

            <View style={styles.amountHeader}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <Pressable onPress={() => setAmount(String(available))}>
                <Text style={styles.maxText}>MAX {formatNum(available, selectedAsset.decimals)}</Text>
              </Pressable>
            </View>
            <View style={styles.amountRow}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textFaint}
                style={styles.amountInput}
                testID="withdraw-amount"
              />
              <Text style={styles.amountSymbol}>{selected}</Text>
            </View>

            <View style={styles.minimumRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textDim} />
              <Text style={styles.minimumText}>
                Minimum {selectedAsset.min_withdraw} {selected}. Destination must support {selectedAsset.network}.
              </Text>
            </View>

            <Pressable onPress={submit} disabled={!canSubmit || busy || loading} testID="withdraw-button">
              <LinearGradient
                colors={canSubmit ? ctaGradient : [colors.cardAlt, colors.cardAlt]}
                style={styles.cta}
              >
                {busy || loading ? (
                  <ActivityIndicator color={canSubmit ? "#08130E" : colors.textFaint} />
                ) : (
                  <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>Review Withdrawal</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            Always match the destination address to the selected network. A withdrawal sent to an incompatible network can be unrecoverable.
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
  securePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 8 },
  secureText: { color: colors.textDim, fontSize: font.tiny, fontWeight: "700" },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.textDim, fontSize: font.small, fontWeight: "700" },
  assetRow: { gap: 8, marginTop: 10 },
  assetButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated },
  assetButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary + "12" },
  assetSymbol: { color: colors.textDim, fontSize: font.body, fontWeight: "900" },
  assetSymbolActive: { color: colors.primary },
  assetBalance: { color: colors.textFaint, fontSize: font.tiny },
  networkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  networkName: { color: colors.text, fontSize: font.h3, fontWeight: "800", marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  addressInput: { color: colors.text, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 13, fontSize: font.small, marginTop: 8 },
  amountHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  maxText: { color: colors.primary, fontSize: font.tiny, fontWeight: "800" },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  amountInput: { flex: 1, color: colors.text, fontSize: 34, fontWeight: "800", paddingVertical: 8 },
  amountSymbol: { color: colors.textDim, fontSize: font.body, fontWeight: "900" },
  minimumRow: { flexDirection: "row", gap: 7, padding: 11, borderRadius: radius.md, backgroundColor: colors.bgElevated },
  minimumText: { flex: 1, color: colors.textDim, fontSize: font.tiny, lineHeight: 16 },
  cta: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  ctaText: { color: "#08130E", fontSize: font.body, fontWeight: "900" },
  ctaTextDisabled: { color: colors.textFaint },
  notice: { flexDirection: "row", gap: 10, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft },
  noticeText: { flex: 1, color: colors.textDim, fontSize: font.small, lineHeight: 19 },
});
