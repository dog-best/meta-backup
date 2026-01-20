import { supabase } from "@/supabase/client";
import { useEffect, useState } from "react";

type Provider = {
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

      const { data, error } = await supabase
        .from("service_providers")
        .select("code,name,active")
        .eq("active", true)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setProviders([]);
        setError("Unable to load providers. Please try again.");
      } else {
        setProviders((data ?? []) as Provider[]);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, loading, error };
}
