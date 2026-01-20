import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const payload = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Alchemy sends an array of activities
    const activities = payload?.event?.activity;
    if (!Array.isArray(activities)) {
      return new Response("No activity", { status: 200 });
    }

    for (const activity of activities) {
      const toAddress = activity.toAddress?.toLowerCase();
      if (!toAddress) continue;

      // Check if this address belongs to one of our users
      const { data: wallet } = await supabase
        .from("crypto_wallets")
        .select("id, user_id, chain")
        .eq("address", toAddress)
        .eq("chain", "ethereum")
        .single();

      if (!wallet) continue;

      // Idempotency: skip if tx already exists
      const { data: existing } = await supabase
        .from("crypto_deposits")
        .select("id")
        .eq("tx_hash", activity.hash)
        .eq("chain", "ethereum")
        .single();

      if (existing) continue;

      const amountEth = Number(activity.value) / 1e18;

      await supabase.from("crypto_deposits").insert({
        user_id: wallet.user_id,
        wallet_id: wallet.id,
        asset_symbol: "ETH",
        chain: "ethereum",
        tx_hash: activity.hash,
        amount: amountEth,
        confirmations: activity.confirmations ?? 0,
        status: "pending",
        raw_tx: activity,
      });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("error", { status: 500 });
  }
});
