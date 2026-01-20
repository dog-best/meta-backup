import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  let userAccountId: string | null = null;
  let clearingAccountId: string | null = null;
  let amount = 0;
  let reference = "";

  try {
    if (req.method !== "POST") return json(405, { success: false, message: "Method not allowed" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return json(401, { success: false, message: "Unauthorized" });

    const {
      amount: inputAmount,
      bank_code,
      account_number,
      account_name,
      reference: inputReference,
    } = await req.json();

    amount = Number(inputAmount);
    reference = String(inputReference);

    if (!reference || !Number.isFinite(amount) || amount <= 0 || !bank_code || !account_number) {
      return json(400, { success: false, message: "Invalid payload" });
    }

    // idempotency by reference
    const { data: existing } = await supabase
      .from("withdrawals")
      .select("status, reference")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return json(200, { success: true, reference, status: existing.status });
    }

    // Ledger accounts
    const { data: userAccount } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "user")
      .eq("owner_id", user.id)
      .eq("currency", "NGN")
      .single();

    const { data: clearingAccount } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_type", "system")
      .eq("account_type", "withdrawal_clearing")
      .single();

    if (!userAccount || !clearingAccount) {
      return json(500, { success: false, message: "Ledger accounts missing" });
    }

    userAccountId = userAccount.id;
    clearingAccountId = clearingAccount.id;

    // create withdrawal record
    await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount,
      bank_code,
      account_number,
      account_name,
      status: "pending",
      reference,
    });

    // debit user -> withdrawal clearing
    const { error: debitError } = await supabase.rpc("post_transfer", {
      p_from_account: userAccountId,
      p_to_account: clearingAccountId,
      p_amount: amount,
      p_reference: reference,
      p_metadata: { type: "withdrawal" },
    });

    if (debitError) throw debitError;

    await supabase.from("withdrawals").update({ status: "processing" }).eq("reference", reference);

    // Paystack: create recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: account_name || "Wallet Withdrawal",
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const recipient = await recipientRes.json();
    if (!recipientRes.ok || !recipient?.status) throw new Error("Recipient creation failed");

    // Paystack: initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount * 100),
        recipient: recipient.data.recipient_code,
        reference,
      }),
    });

    const transfer = await transferRes.json();
    if (!transferRes.ok || !transfer?.status) throw new Error("Transfer initiation failed");

    await supabase
      .from("withdrawals")
      .update({
        paystack_transfer_code: transfer.data?.transfer_code ?? null,
        paystack_response: transfer,
      })
      .eq("reference", reference);

    // ✅ do NOT mark successful here — webhook will finalize
    return json(200, { success: true, reference, status: "processing" });
  } catch (err) {
    console.error("WITHDRAW ERROR:", err);

    // Refund if debited
    if (userAccountId && clearingAccountId && amount && reference) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await admin.rpc("post_transfer", {
        p_from_account: clearingAccountId,
        p_to_account: userAccountId,
        p_amount: amount,
        p_reference: `${reference}-REFUND`,
        p_metadata: { reason: "withdrawal_failed" },
      });

      await admin.from("withdrawals").update({ status: "refunded" }).eq("reference", reference);
    }

    return json(500, { success: false, message: "Withdrawal failed. Wallet refunded." });
  }
});
