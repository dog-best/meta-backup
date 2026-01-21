import { supabase } from "@/supabase/client";
import { useEffect, useState } from "react";

export type Provider = {
  code: string;
  name: string;
  active: boolean;
};

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("service_providers")
          .select("code, name, active")
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        if (!cancelled) setProviders((data ?? []) as Provider[]);
      } catch (e: any) {
        console.error("Providers load error:", e);
        if (!cancelled) {
          setProviders([]);
          setError("Failed to load providers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, loading, error };
}
