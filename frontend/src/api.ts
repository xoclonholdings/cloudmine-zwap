import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const UID_KEY = "zwap_uid";

let cachedUid: string | null = null;

function genId(): string {
  return "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getUserId(): Promise<string> {
  if (cachedUid) return cachedUid;
  let uid = await storage.getItem<string>(UID_KEY, "");
  if (!uid) {
    uid = genId();
    await storage.setItem(UID_KEY, uid);
  }
  cachedUid = uid;
  return uid;
}

async function request(path: string, options: RequestInit = {}) {
  const uid = await getUserId();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": uid,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || "Request failed");
  }
  return data;
}

export type MineState = {
  active: boolean;
  pending: number;
  progress: number;
  seconds_left: number;
  rate_per_hour: number;
};

export type UserState = {
  id: string;
  zwap_balance: number;
  zwap_usd: number;
  assets: Record<string, number>;
  total_mined: number;
  mine: MineState;
};

export type Asset = {
  symbol: string;
  name: string;
  network: string;
  price_usd: number;
  min_withdraw: number;
  decimals: number;
  color: string;
};

export const api = {
  me: (): Promise<UserState> => request("/me"),
  mineStart: () => request("/mine/start", { method: "POST" }),
  mineClaim: (): Promise<UserState> => request("/mine/claim", { method: "POST" }),
  swapAssets: (): Promise<{ zwap_usd: number; fee_pct: number; assets: Asset[] }> =>
    request("/swap/assets"),
  swapQuote: (zwap_amount: number, to_symbol: string) =>
    request("/swap/quote", { method: "POST", body: JSON.stringify({ zwap_amount, to_symbol }) }),
  swapExecute: (zwap_amount: number, to_symbol: string): Promise<UserState> =>
    request("/swap/execute", { method: "POST", body: JSON.stringify({ zwap_amount, to_symbol }) }),
  withdraw: (symbol: string, amount: number, address: string) =>
    request("/withdraw", { method: "POST", body: JSON.stringify({ symbol, amount, address }) }),
  activity: (): Promise<any[]> => request("/activity"),
};
