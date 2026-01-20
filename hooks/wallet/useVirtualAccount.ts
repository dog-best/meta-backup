import { supabase } from "@/supabase/client";
import { useCallback, useEffect, useState } from "react";

export type VirtualAccount = {
  account_number: string;
  bank_name: string;
  account_name: string;
  currency: string;
  active: boolean;
};

export function useVirtualAccount() {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("paystack-dva", {
        body: {}, // POST
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.message ?? "Failed to load account");

      setAccount(data.account);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load account");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { account, loading, error, refetch: load };
}
