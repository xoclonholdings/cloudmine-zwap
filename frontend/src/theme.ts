// ZWAP MineSwap — theme modeled on the HashPower BTC reference
// (deep purple "space" background, mint-green CTA, bitcoin-orange accent).
// Re-skin the whole app by editing the tokens in this file.
export const colors = {
  // Backgrounds (space gradient uses bgGradient below)
  bg: "#0B0714",
  bgElevated: "#140B22",
  card: "#1A1030",
  cardAlt: "#221542",
  border: "#3A2A5C",
  borderSoft: "#281A45",

  // Text
  text: "#F5F1FF",
  textDim: "#A99CC6",
  textFaint: "#6B5E88",

  // --- Brand accents. Change these to re-skin. ---
  primary: "#39E0A0",       // mint-green CTA (Start Mining)
  primaryDim: "#22B37E",
  accent: "#8B5CF6",        // neon purple glow
  accentDim: "#6D3FD4",
  // ------------------------------------------------

  btc: "#F7931A",           // bitcoin orange
  success: "#39E0A0",
  danger: "#FF5C6C",
  warning: "#FFB020",
};

// Full-screen background gradient (top -> bottom)
export const bgGradient = ["#160A28", "#0B0714", "#0B0714"] as const;
// Card / pedestal glow gradient
export const glowGradient = ["#3B1F6E", "#1A1030"] as const;
export const ctaGradient = ["#4BF0AE", "#22B37E"] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const font = {
  h1: 30,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
};
