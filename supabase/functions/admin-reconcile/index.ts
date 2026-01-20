import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Category = "wallet_funding" | "withdrawal" | "airtime" | "data";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const runDate =
    body.date ??
    new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // yesterday (YYYY-MM-DD)

  try {
    /* ───────────────────────────────
       1️⃣ CREATE RECONCILIATION RUN
    ─────────────────────────────── */
    const { data: run, error: runError } = await admin
      .from("reconciliation_runs")
      .insert({
        run_date: runDate,
        status: "pending",
      })
      .select()
      .single();

    if (runError) throw runError;

    const runId = run.id;

    /* ───────────────────────────────
       2️⃣ LEDGER TOTALS
    ─────────────────────────────── */
    const ledgerTotals: Record<Category, number> = {
      wallet_funding: 0,
      withdrawal: 0,
      airtime: 0,
      data: 0,
    };

    // Wallet funding (Paystack credits)
    const { data: funding } = await admin.rpc(
      "sum_ledger_by_reference_prefix",
      {
        p_prefix: "PAYSTACK",
        p_date: runDate,
      }
    );
    ledgerTotals.wallet_funding = funding ?? 0;

    // Withdrawals
    const { data: withdrawals } = await admin.rpc(
      "sum_ledger_by_metadata_type",
      {
        p_type: "withdrawal",
        p_date: runDate,
      }
    );
    ledgerTotals.withdrawal = withdrawals ?? 0;

    // Utilities
    const { data: utilities } = await admin
      .from("utility_purchases")
      .select("utility_type, amount")
      .eq("status", "successful")
      .gte("created_at", `${runDate}T00:00:00Z`)
      .lte("created_at", `${runDate}T23:59:59Z`);

    for (const u of utilities ?? []) {
      ledgerTotals[u.utility_type as Category] += Number(u.amount);
    }

    /* ───────────────────────────────
       3️⃣ PAYSTACK TOTALS
    ─────────────────────────────── */
    const paystackTotals: Record<Category, number> = {
      wallet_funding: 0,
      withdrawal: 0,
      airtime: 0,
      data: 0,
    };

    async function fetchPaystack(endpoint: string) {
      const res = await fetch(`https://api.paystack.co/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        },
      });
      const json = await res.json();
      if (!json.status) throw new Error("Paystack fetch failed");
      return json.data;
    }

    // Wallet funding
    const transactions = await fetchPaystack(
      `transaction?from=${runDate}&to=${runDate}`
    );
    for (const t of transactions) {
      if (t.status === "success") {
        paystackTotals.wallet_funding += t.amount / 100;
      }
    }

    // Withdrawals
    const transfers = await fetchPaystack(
      `transfer?from=${runDate}&to=${runDate}`
    );
    for (const t of transfers) {
      if (t.status === "success") {
        paystackTotals.withdrawal += t.amount / 100;
      }
    }

    // Bills (airtime + data)
    const bills = await fetchPaystack(
      `bill?from=${runDate}&to=${runDate}`
    );
    for (const b of bills) {
      if (b.type === "airtime") paystackTotals.airtime += b.amount / 100;
      if (b.type === "data") paystackTotals.data += b.amount / 100;
    }

    /* ───────────────────────────────
       4️⃣ COMPARE & RECORD MISMATCHES
    ─────────────────────────────── */
    let totalLedger = 0;
    let totalPaystack = 0;

    for (const category of Object.keys(ledgerTotals) as Category[]) {
      const ledgerAmount = ledgerTotals[category];
      const paystackAmount = paystackTotals[category];

      totalLedger += ledgerAmount;
      totalPaystack += paystackAmount;

      const status =
        ledgerAmount === paystackAmount
          ? "matched"
          : "amount_mismatch";

      await admin.from("reconciliation_items").insert({
        run_id: runId,
        category,
        ledger_amount: ledgerAmount,
        paystack_amount: paystackAmount,
        status,
        metadata: {
          difference: ledgerAmount - paystackAmount,
        },
      });
    }

    /* ───────────────────────────────
       5️⃣ FINALIZE RUN
    ─────────────────────────────── */
    await admin
      .from("reconciliation_runs")
      .update({
        status: "completed",
        total_ledger: totalLedger,
        total_paystack: totalPaystack,
        discrepancy: totalLedger - totalPaystack,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        run_date: runDate,
        discrepancy: totalLedger - totalPaystack,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("RECONCILIATION ERROR:", err);

    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500 }
    );
  }
});
