import { useAuth } from "@/hooks/authenication/useAuth";
import { supabase } from "@/supabase/client";
import { useCallback, useEffect, useState } from "react";

type WalletBalance = {
  account_id: string;
  balance: number;
  last_activity_at: string | null;
};

export function useWallet() {
  const { user } = useAuth();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!user) {
      setWallet(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
  .from("wallet_balances")
  .select("account_id, balance, last_activity_at")
  .eq("user_id", user.id)
  .single();


    if (error) {
      console.error("Wallet fetch error:", error);
      setError("Failed to load wallet balance");
      setWallet(null);
    } else {
      setWallet(data);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // 🔔 Realtime: listen to ledger changes
  useEffect(() => {
    if (!user || !wallet?.account_id) return;

    const channel = supabase
      .channel("wallet-balance-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledger_entries",
          filter: `account_id=eq.${wallet.account_id}`,
        },
        () => {
          fetchWallet();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, wallet?.account_id, fetchWallet]);

  return {
    wallet,              // { account_id, balance, last_activity_at }
    balance: wallet?.balance ?? 0,
    loading,
    error,
    refetch: fetchWallet,
  };
}
