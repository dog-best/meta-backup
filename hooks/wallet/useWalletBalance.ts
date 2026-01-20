// hooks/useWalletBalance.ts
import { supabase } from "@/supabase/client";
import { useEffect, useState } from "react";

export function useWalletBalance(userId?: string) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);

      // get user's NGN account
      const { data: account } = await supabase
        .from("ledger_accounts")
        .select("id")
        .eq("owner_type", "user")
        .eq("owner_id", userId)
        .eq("currency", "NGN")
        .single();

      if (!account) {
        setBalance(0);
        setLoading(false);
        return;
      }

      // sum credits - debits
      const { data: entries } = await supabase
        .from("ledger_entries")
        .select("direction, amount")
        .eq("account_id", account.id);

      const running = entries?.reduce((acc, e) => {
        return e.direction === "credit"
          ? acc + Number(e.amount)
          : acc - Number(e.amount);
      }, 0);

      setBalance(running || 0);
      setLoading(false);
    };

    load();
  }, [userId]);

  return { balance, loading };
}
