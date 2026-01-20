import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BillCategory = "electricity" | "betting";

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

function paystackEndpoint(category: BillCategory) {
  // Paystack bills endpoints
  // - Electricity: https://api.paystack.co/bill/electricity
  // - Betting:     https://api.paystack.co/bill/betting
  return `https://api.paystack.co/bill/${category}`;
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

    // user-scoped client (RLS enforced)
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

    /* 2) INPUT */
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

    const category = String(payload?.category ?? "").trim() as BillCategory;
    reference = String(payload?.reference ?? "").trim();
    amount = Number(payload?.amount ?? 0);

    if (!category || (category !== "electricity" && category !== "betting")) {
      return json(400, {
        success: false,
        code: "INVALID_REQUEST",
        message: safeMessageForStatus("INVALID_REQUEST"),
        request_id: rid,
      });
    }

    if (!reference || !Number.isFinite(amount) || amount <= 0) {
      return json(400, {
        success: false,
        code: "INVALID_REQUEST",
        message: safeMessageForStatus("INVALID_REQUEST"),
        request_id: rid,
      });
    }

    // category-specific validation + provider payload
    let provider = "";
    let customerReference = "";
    let providerPayload: Record<string, unknown> = {};

    if (category === "electricity") {
      const disco = String(payload?.disco ?? "").trim();
      const meter_number = String(payload?.meter_number ?? "").trim();
      const meter_type = String(payload?.meter_type ?? "").trim();

      if (!disco || !meter_number || (meter_type !== "prepaid" && meter_type !== "postpaid")) {
        return json(400, {
          success: false,
          code: "INVALID_REQUEST",
          message: safeMessageForStatus("INVALID_REQUEST"),
          request_id: rid,
        });
      }

      provider = disco;
      customerReference = meter_number;
      providerPayload = {
        disco,
        meter_number,
        meter_type,
        amount,
        reference,
      };
    }

    if (category === "betting") {
      const operator = String(payload?.operator ?? "").trim();
      const customer_id = String(payload?.customer_id ?? "").trim();

      if (!operator || !customer_id) {
        return json(400, {
          success: false,
          code: "INVALID_REQUEST",
          message: safeMessageForStatus("INVALID_REQUEST"),
          request_id: rid,
        });
      }

      provider = operator;
      customerReference = customer_id;
      providerPayload = {
        operator,
        customer_id,
        amount,
        reference,
      };
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
      // Keep schema-compatible fields (mirrors paystack-airtime)
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        utility_type: category,
        provider,
        phone: customerReference, // for electricity/betting this holds meter/customer id
        amount,
        status: "pending",
        reference,
      };

      const { error: insErr } = await supabase.from("utility_purchases").insert(insertPayload);
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
      p_metadata: {
        type: category,
        provider,
        customer_reference: customerReference,
      },
    });

    if (ledgerError) {
      console.error(`[${rid}] ledger transfer failed`, ledgerError);

      if (isProbablyInsufficientFunds(ledgerError)) {
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

    await supabase.from("utility_purchases").update({ status: "debited" }).eq("reference", reference);
    await supabase.from("utility_purchases").update({ status: "processing" }).eq("reference", reference);

    /* 6) PAYSTACK */
    const res = await fetch(paystackEndpoint(category), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(providerPayload),
    });

    const result = await res.json().catch(() => ({}));

    if (res.ok && (result as any)?.status === true) {
      await supabase
        .from("utility_purchases")
        .update({
          status: "successful",
          provider_reference: (result as any)?.data?.reference ?? null,
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
        provider_response: {
          paystack_response: result,
          http_ok: res.ok,
          category,
        },
      })
      .eq("reference", reference);

    if (debited && userAccountId && utilityAccountId) {
      await refundUtilityPayment({
        userAccountId,
        utilityAccountId,
        amount,
        reference,
        rid,
        reason: `${category}_purchase_failed`,
      });
    }

    return json(502, {
      success: false,
      code: "PROVIDER_ERROR",
      message: safeMessageForStatus("PROVIDER_ERROR"),
      request_id: rid,
    });
  } catch (err) {
    console.error(`[${rid}] PAY-BILL ERROR:`, err);

    if (debited && userAccountId && utilityAccountId && amount && reference) {
      await refundUtilityPayment({
        userAccountId,
        utilityAccountId,
        amount,
        reference,
        rid,
        reason: "unexpected_error",
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
  reason,
}: {
  userAccountId: string;
  utilityAccountId: string;
  amount: number;
  reference: string;
  rid: string;
  reason: string;
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
      p_metadata: { reason, request_id: rid },
    });

    await admin.from("utility_purchases").update({ status: "refunded" }).eq("reference", reference);
  } catch (e) {
    console.error(`[${rid}] refund failed`, e);
  }
}
