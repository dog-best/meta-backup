import { supabase } from "@/supabase/client";

export type CryptoAsset = "USDT" | "USDC" | "ETH";

export async function ensureCryptoWallet() {
  const { data, error } = await supabase.functions.invoke("create-crypto-wallet", {
    body: {},
  });
  if (error) throw error;
  return data;
}

export async function getCryptoPrice(asset: CryptoAsset) {
  const { data, error } = await supabase.functions.invoke("get-crypto-price", {
    body: { asset },
  });
  if (error) throw error;
  return data;
}

export async function convertCryptoToNgn(payload: {
  asset: CryptoAsset;
  amount: number;
  reference: string;
}) {
  const { data, error } = await supabase.functions.invoke("convert-crypto-to-ngn", {
    body: payload,
  });
  if (error) throw error;
  return data;
}
