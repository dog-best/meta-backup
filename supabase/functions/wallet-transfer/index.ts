import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isLikelyAccountNumber(v: string) {
  // Nigerian NUBAN is typically 10 digits
  return /^\d{10}$/.test(v);
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { success: false, message: "Method not allowed" });

  // user-scoped client (JWT)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  // admin client (for idempotency + writes even with RLS)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1) Auth
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user || authError) return json(401, { success: false, message: "Unauthorized" });

    // 2) Input (ONE recipient field)
    const { recipient, amount, reference } = await req.json();

    const numericAmount = Number(amount);
    const recipientStr = String(recipient ?? "").trim();
    const referenceStr = String(reference ?? "").trim();

    if (!recipientStr) return json(400, { success: false, message: "Recipient is required" });
    if (!referenceStr) return json(400, { success: false, message: "Reference is required" });
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return json(400, { success: false, message: "Invalid amount" });
    }

    // 3) Idempotency lock
    const idempoKey = `${referenceStr}`;
    const { error: idemErr } = await admin.from("idempotency_keys").insert({
      key: idempoKey,
      scope: "wallet-transfer",
    });

    // if duplicate key => already processing/processed
    if (idemErr && String(idemErr.message).toLowerCase().includes("duplicate")) {
      // return current status if exists
      const { data: existing } = await admin
        .from("transfers")
        .select("status, reference")
        .eq("reference", referenceStr)
        .maybeSingle();

      return json(200, {
        success: true,
        reference: referenceStr,
        status: existing?.status ?? "pending",
        message: "Already submitted",
      });
    }

    // 4) Sender account
    const { data: senderAccount, error: senderErr } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "user")
      .eq("owner_id", user.id)
      .eq("currency", "NGN")
      .single();

    if (senderErr || !senderAccount) {
      return json(404, { success: false, message: "Sender wallet not found" });
    }

    // 5) Resolve recipient user_id
    let recipientUserId: string | null = null;

    if (isLikelyAccountNumber(recipientStr)) {
      const { data: va } = await admin
        .from("user_virtual_accounts")
        .select("user_id")
        .eq("account_number", recipientStr)
        .eq("active", true)
        .maybeSingle();

      recipientUserId = va?.user_id ?? null;
    } else {
      // treat as public_uid
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("public_uid", recipientStr)
        .maybeSingle();

      recipientUserId = profile?.id ?? null;
    }

    if (!recipientUserId) {
      return json(404, { success: false, message: "Recipient not found" });
    }
    if (recipientUserId === user.id) {
      return json(400, { success: false, message: "You cannot transfer to yourself" });
    }

    // 6) Recipient account
    const { data: recipientAccount, error: recvErr } = await admin
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "user")
      .eq("owner_id", recipientUserId)
      .eq("currency", "NGN")
      .single();

    if (recvErr || !recipientAccount) {
      return json(404, { success: false, message: "Recipient wallet not found" });
    }

    // 7) Create transfer record
    await admin.from("transfers").insert({
      from_account: senderAccount.id,
      to_account: recipientAccount.id,
      amount: numericAmount,
      currency: "NGN",
      status: "pending",
      reference: referenceStr,
      metadata: {
        type: "internal_transfer",
        recipient_lookup: recipientStr,
        recipient_user_id: recipientUserId,
      },
    });

    // 8) Post ledger transfer (atomic)
    const { error: ledgerErr } = await admin.rpc("post_transfer", {
      p_from_account: senderAccount.id,
      p_to_account: recipientAccount.id,
      p_amount: numericAmount,
      p_reference: referenceStr,
      p_metadata: {
        type: "internal_transfer",
        recipient_user_id: recipientUserId,
      },
    });

    if (ledgerErr) {
      await admin
        .from("transfers")
        .update({ status: "failed", metadata: { error: ledgerErr.message } })
        .eq("reference", referenceStr);

      return json(400, { success: false, message: ledgerErr.message });
    }

    await admin
      .from("transfers")
      .update({ status: "completed" })
      .eq("reference", referenceStr);

    return json(200, { success: true, reference: referenceStr, status: "completed" });
  } catch (err) {
    console.error("wallet-transfer error:", err);
    return json(500, { success: false, message: "Server error" });
  }
});

