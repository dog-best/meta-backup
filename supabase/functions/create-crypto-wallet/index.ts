import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Keypair } from "https://esm.sh/@solana/web3.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { chain } = await req.json();

    if (!chain) {
      return new Response("Chain is required", { status: 400 });
    }

    // Check if wallet already exists
    const { data: existing } = await supabase
      .from("crypto_wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("chain", chain)
      .single();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let address: string;

    // ---- EVM CHAINS ----
    if (["ethereum", "base", "arbitrum", "bnb"].includes(chain)) {
      const mnemonic = Deno.env.get("EVM_WALLET_MNEMONIC");
      if (!mnemonic) throw new Error("EVM mnemonic missing");

      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
      const wallet = hdNode.derivePath(`m/44'/60'/0'/0/${Date.now() % 100000}`);
      address = wallet.address;
    }

    // ---- SOLANA ----
    else if (chain === "solana") {
      const secret = Deno.env.get("SOLANA_WALLET_SECRET");
      if (!secret) throw new Error("Solana secret missing");

      const secretKey = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
      const keypair = Keypair.fromSecretKey(secretKey);
      address = keypair.publicKey.toBase58();
    }

    else {
      return new Response("Unsupported chain", { status: 400 });
    }

    const { data, error } = await supabase
      .from("crypto_wallets")
      .insert({
        user_id: user.id,
        chain,
        address,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
