import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PurchaseStatus =
  | "pending"
  | "debited"
  | "processing"
  | "successful"
  | "failed"
  | "refunded";

type ErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "DUPLICATE_IN_PROGRESS"
  | "DUPLICATE_COMPLETED"
  | "INSUFFICIENT_FUNDS"
  | "PROVIDER_ERROR"
  | "BACKEND_ERROR";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestId() {
  // cheap unique id for logs + client support
  return crypto.randomUUID();
}

function safeMessageForStatus(code: ErrorCode) {
  switch (code) {
    case "UNAUTHORIZED":
      return "Please sign in to continue.";
    case "INVALID_REQUEST":
      return "Please check your details and try again.";
    case "DUPLICATE_IN_PROGRESS":
      return "This transaction is already in progress. Please wait.";
    case "DUPLICATE_COMPLETED":
      return "This transaction has already been completed.";
    case "INSUFFICIENT_FUNDS":
      return "Insufficient wallet balance. Please fund your wallet and try again.";
    case "PROVIDER_ERROR":
      return "We couldn’t complete this purchase right now. Please try again shortly.";
    default:
      return "We couldn’t complete your request right now. Please try again.";
  }
}

function isProbablyInsufficientFunds(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("insufficient") ||
    msg.includes("balance") ||
    msg.includes("not enough") ||
    msg.includes("funds")
  );
}

serve(async (req) => {
  const rid = requestId();

  // variables for refund logic
  let userAccountId: string | null = null;
  let utilityAccountId: string | null = null;
  let amount = 0;
  let reference = "";
  let debited = false;

  try {
    if (req.method !== "POST") {
      return json(405, {
        success: false,
        code: "INVALID_REQUEST",
        message: safeMessageForStatus("INVALID_REQUEST"),
        request_id: rid,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, {
        success: false,
        code: "UNAUTHORIZED",
        message: safeMessageForStatus("UNAUTHORIZED"),
        request_id: rid,
      });
    }

    // user-scoped client (uses user's JWT)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    /* 1) AUTH */
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user || authError) {
      return json(401, {
        success: false,
        code: "UNAUTHORIZED",
        message: safeMessageForStatus("UNAUTHORIZED"),
        request_id: rid,
      });
    }

    /* 2) INPUT (safe parsing) */
    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return json(400, {
        success: false,
        code: "INVALID_REQUEST",
        message: safeMessageForStatus("INVALID_REQUEST"),
        request_id: rid,
      });
    }

    const phone = String(payload?.phone ?? "").trim();
    const provider = String(payload?.provider ?? "").trim();
    reference = String(payload?.reference ?? "").trim();
    amount = Number(payload?.amount ?? 0);

    if (!phone || !provider || !reference || !Number.isFinite(amount) || amount <= 0) {
      return json(400, {
        success: false,
        code: "INVALID_REQUEST",
        message: safeMessageForStatus("INVALID_REQUEST"),
        request_id: rid,
      });
    }

    /* 3) ACCOUNTS */
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
      console.error(`[${rid}] ledger accounts not found`, { uaErr, utilErr });
      return json(500, {
        success: false,
        code: "BACKEND_ERROR",
        message: safeMessageForStatus("BACKEND_ERROR"),
        request_id: rid,
      });
    }

    userAccountId = userAccount.id;
    utilityAccountId = utilityAccount.id;

    /* 4) IDEMPOTENCY */
    const { data: existing, error: existingErr } = await supabase
      .from("utility_purchases")
      .select("id,status,reference")
      .eq("reference", reference)
      .maybeSingle();

    if (existingErr) {
      console.error(`[${rid}] existing lookup error`, existingErr);
      return json(500, {
        success: false,
        code: "BACKEND_ERROR",
        message: safeMessageForStatus("BACKEND_ERROR"),
        request_id: rid,
      });
    }

    if (existing) {
      const status = existing.status as PurchaseStatus;

      if (status === "successful") {
        return json(200, { success: true, reference, request_id: rid });
      }

      if (status === "pending" || status === "debited" || status === "processing") {
        return json(409, {
          success: false,
          code: "DUPLICATE_IN_PROGRESS",
          message: safeMessageForStatus("DUPLICATE_IN_PROGRESS"),
          reference,
          request_id: rid,
        });
      }

      if (status === "failed" || status === "refunded") {
        return json(409, {
          success: false,
          code: "DUPLICATE_COMPLETED",
          message: safeMessageForStatus("DUPLICATE_COMPLETED"),
          reference,
          request_id: rid,
        });
      }
    } else {
      const { error: insErr } = await supabase.from("utility_purchases").insert({
        user_id: user.id,
        utility_type: "airtime",
        provider,
        phone,
        amount,
        status: "pending",
        reference,
      });

      if (insErr) {
        console.error(`[${rid}] insert purchase error`, insErr);
        return json(500, {
          success: false,
          code: "BACKEND_ERROR",
          message: safeMessageForStatus("BACKEND_ERROR"),
          request_id: rid,
        });
      }
    }

    /* 5) DEBIT USER */
    const { error: ledgerError } = await supabase.rpc("post_transfer", {
      p_from_account: userAccountId,
      p_to_account: utilityAccountId,
      p_amount: amount,
      p_reference: reference,
      p_metadata: { type: "airtime", phone, provider },
    });

    if (ledgerError) {
      console.error(`[${rid}] ledger transfer failed`, ledgerError);

      if (isProbablyInsufficientFunds(ledgerError)) {
        // keep purchase record consistent
        await supabase
          .from("utility_purchases")
          .update({ status: "failed", provider_response: { reason: "insufficient_funds" } })
          .eq("reference", reference);

        return json(402, {
          success: false,
          code: "INSUFFICIENT_FUNDS",
          message: safeMessageForStatus("INSUFFICIENT_FUNDS"),
          request_id: rid,
        });
      }

      return json(500, {
        success: false,
        code: "BACKEND_ERROR",
        message: safeMessageForStatus("BACKEND_ERROR"),
        request_id: rid,
      });
    }

    debited = true;

    await supabase
      .from("utility_purchases")
      .update({ status: "debited" })
      .eq("reference", reference);

    /* 6) PAYSTACK */
    await supabase
      .from("utility_purchases")
      .update({ status: "processing" })
      .eq("reference", reference);

    const res = await fetch("https://api.paystack.co/bill/airtime", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, amount, provider, reference }),
    });

    const result = await res.json().catch(() => ({}));

    if (res.ok && result?.status === true) {
      await supabase
        .from("utility_purchases")
        .update({
          status: "successful",
          provider_reference: result?.data?.reference ?? null,
          provider_response: result,
        })
        .eq("reference", reference);

      return json(200, { success: true, reference, request_id: rid });
    }

    // Provider failed — mark failed, then refund
    await supabase
      .from("utility_purchases")
      .update({
        status: "failed",
        provider_response: { paystack_response: result, http_ok: res.ok },
      })
      .eq("reference", reference);

    // Refund when provider fails after debit
    if (debited && userAccountId && utilityAccountId) {
      await refundUtilityPayment({
        userAccountId,
        utilityAccountId,
        amount,
        reference,
        rid,
      });
    }

    return json(502, {
      success: false,
      code: "PROVIDER_ERROR",
      message: safeMessageForStatus("PROVIDER_ERROR"),
      request_id: rid,
    });
  } catch (err) {
    console.error(`[${rid}] AIRTIME PURCHASE ERROR:`, err);

    // Refund only if we KNOW debit happened
    if (debited && userAccountId && utilityAccountId && amount && reference) {
      await refundUtilityPayment({
        userAccountId,
        utilityAccountId,
        amount,
        reference,
        rid,
      });
    }

    return json(500, {
      success: false,
      code: "BACKEND_ERROR",
      message: safeMessageForStatus("BACKEND_ERROR"),
      request_id: rid,
    });
  }
});

async function refundUtilityPayment({
  userAccountId,
  utilityAccountId,
  amount,
  reference,
  rid,
}: {
  userAccountId: string;
  utilityAccountId: string;
  amount: number;
  reference: string;
  rid: string;
}) {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await admin.rpc("post_transfer", {
      p_from_account: utilityAccountId,
      p_to_account: userAccountId,
      p_amount: amount,
      p_reference: `${reference}-REFUND`,
      p_metadata: { reason: "airtime_purchase_failed", request_id: rid },
    });

    await admin
      .from("utility_purchases")
      .update({ status: "refunded" })
      .eq("reference", reference);
  } catch (e) {
    console.error(`[${rid}] refund failed`, e);
    // do not throw; refund failure should not crash response
  }
}
