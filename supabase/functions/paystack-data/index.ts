import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PurchaseStatus =
  | "pending"
  | "debited"
  | "processing"
  | "successful"
  | "failed"
  | "refunded";

serve(async (req) => {
  let userAccountId: string | null = null;
  let utilityAccountId: string | null = null;
  let amount = 0;
  let reference = "";

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // User-scoped client (uses user's JWT)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 1) Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2) Input (UI sends ONLY product_code, not amount/plan_code)
    const { phone, provider, product_code, reference: inputReference } =
      await req.json();

    if (!phone || !provider || !product_code || !inputReference) {
      return new Response("Invalid payload", { status: 400 });
    }

    reference = String(inputReference);

    // 3) Fetch product (DB-controlled)
    const { data: product, error: productErr } = await supabase
      .from("service_products")
      .select("product_code, provider_code, category_code, active, paystack_item_code")
      .eq("product_code", product_code)
      .eq("provider_code", provider)
      .eq("category_code", "data")
      .eq("active", true)
      .single();

    if (productErr || !product) {
      return new Response("Product not found", { status: 404 });
    }

    const paystackItemCode = product.paystack_item_code;
    if (!paystackItemCode) {
      // Admin needs to set this in DB for the bundle
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "This data bundle is missing paystack_item_code. Set it in service_products.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4) Pick best offer (highest priority, active, within time window)
    const nowIso = new Date().toISOString();

    const { data: offer, error: offerErr } = await supabase
      .from("service_offers")
      .select("id, base_price, promo_price, offer_type, cashback, bonus_data_mb, start_at, end_at, priority, active, product_code")
      .eq("product_code", product_code)
      .eq("active", true)
      .or(`start_at.is.null,start_at.lte.${nowIso}`)
      .or(`end_at.is.null,end_at.gte.${nowIso}`)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (offerErr) throw offerErr;

    if (!offer) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "No active offer found for this bundle. Add an offer in service_offers.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    amount = Number(offer.promo_price ?? offer.base_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response("Invalid offer pricing", { status: 500 });
    }

    // 5) Ledger accounts
    const { data: userAccount, error: uaErr } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "user")
      .eq("owner_id", user.id)
      .eq("currency", "NGN")
      .single();

    const { data: utilityAccount, error: utilErr } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "system")
      .eq("account_type", "utility_clearing")
      .single();

    if (uaErr || utilErr || !userAccount || !utilityAccount) {
      return new Response("Ledger accounts missing", { status: 500 });
    }

    userAccountId = userAccount.id;
    utilityAccountId = utilityAccount.id;

    // 6) Idempotency: if reference exists, respect existing status
    const { data: existing } = await supabase
      .from("utility_purchases")
      .select("id,status,reference")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      const st = existing.status as PurchaseStatus;
      if (st === "successful") {
        return new Response(
          JSON.stringify({ success: true, reference }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // If it's processing/pending, tell client to wait
      if (st === "processing" || st === "pending" || st === "debited") {
        return new Response(
          JSON.stringify({ success: true, reference, status: st }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // if failed/refunded, allow retry with a NEW reference (client should generate new reference)
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "This reference was used before and did not complete. Generate a new reference and try again.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7) Create purchase record
    const { error: insErr } = await supabase.from("utility_purchases").insert({
      user_id: user.id,
      utility_type: "data",
      provider,
      phone,
      amount,
      status: "pending",
      reference,
    });

    if (insErr) throw insErr;

    // 8) Debit user (ledger)
    const { error: ledgerError } = await supabase.rpc("post_transfer", {
      p_from_account: userAccountId,
      p_to_account: utilityAccountId,
      p_amount: amount,
      p_reference: reference,
      p_metadata: {
        type: "data",
        phone,
        provider,
        product_code,
        offer_id: offer.id,
        paystack_item_code: paystackItemCode,
      },
    });

    if (ledgerError) throw ledgerError;

    await supabase
      .from("utility_purchases")
      .update({ status: "processing" })
      .eq("reference", reference);

    // 9) Call Paystack bills API
    // NOTE: your existing code uses: { phone, provider, plan, amount, reference }
    // paystack_item_code is what you store in DB for "plan"
    const res = await fetch("https://api.paystack.co/bill/data", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        provider,
        plan: paystackItemCode,
        amount,
        reference,
      }),
    });

    const result = await res.json();

    if (res.ok && result.status === true) {
      await supabase
        .from("utility_purchases")
        .update({
          status: "successful",
          provider_reference: result.data?.reference,
          provider_response: result,
        })
        .eq("reference", reference);

      return new Response(
        JSON.stringify({ success: true, reference }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(result?.message ?? "Paystack data purchase failed");
  } catch (err) {
    console.error("DATA PURCHASE ERROR:", err);

    // Refund if we already debited
    if (userAccountId && utilityAccountId && amount && reference) {
      await refundUtilityPayment({
        userAccountId,
        utilityAccountId,
        amount,
        reference,
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Data purchase failed. Wallet refunded.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function refundUtilityPayment({
  userAccountId,
  utilityAccountId,
  amount,
  reference,
}: {
  userAccountId: string;
  utilityAccountId: string;
  amount: number;
  reference: string;
}) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Reverse: utility_clearing -> user
  await admin.rpc("post_transfer", {
    p_from_account: utilityAccountId,
    p_to_account: userAccountId,
    p_amount: amount,
    p_reference: `${reference}-REFUND`,
    p_metadata: { reason: "data_purchase_failed" },
  });

  await admin
    .from("utility_purchases")
    .update({ status: "refunded" })
    .eq("reference", reference);
}
