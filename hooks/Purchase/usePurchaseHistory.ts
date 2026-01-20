import { supabase } from "@/supabase/client";
import { useEffect, useState } from "react";

export function usePurchaseHistory(userId?: string) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("utility_purchases")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setHistory([]);
      } else {
        setHistory(data ?? []);
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { history, loading, error };
}
