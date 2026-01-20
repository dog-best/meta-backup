import { useWallet } from "@/hooks/wallet/useWallet";
import { supabase } from "@/supabase/client";
import { useCallback, useEffect, useState } from "react";

export type LedgerEntry = {
  id: string;
  account_id: string;
  direction: "credit" | "debit";
  amount: number;
  reference: string;
  metadata: Record<string, any>;
  created_at: string;
};

export function useLedger(limit: number = 20) {
  const { wallet } = useWallet();

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    if (!wallet?.account_id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("ledger_entries")
      .select("*")
      .eq("account_id", wallet.account_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Ledger fetch error:", error);
      setError("Failed to load transactions");
      setEntries([]);
    } else {
      setEntries(data || []);
    }

    setLoading(false);
  }, [wallet?.account_id, limit]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // 🔔 Realtime updates
  useEffect(() => {
    if (!wallet?.account_id) return;

    const channel = supabase
      .channel("ledger-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledger_entries",
          filter: `account_id=eq.${wallet.account_id}`,
        },
        () => fetchLedger()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wallet?.account_id, fetchLedger]);

  return {
    entries,
    loading,
    error,
    refetch: fetchLedger,
  };
}
