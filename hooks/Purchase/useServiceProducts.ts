// hooks/useServiceProducts.ts
import { supabase } from "@/supabase/client";
import { useEffect, useState } from "react";

export type UtilityProduct = {
  product_code: string;
  name: string;
  data_size_mb: number | null;
  validity_label: string | null;

  has_offer: boolean;
  base_price: number;
  final_price: number;
  cashback: number;
  bonus_data_mb: number;
};

export function useServiceProducts(category: string, provider: string) {
  const [products, setProducts] = useState<UtilityProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider || !category) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.functions.invoke(
          "fetch-utility-category",
          {
            method: "GET",
            // Edge functions read query params from the URL,
            // so we pass them as `headers` is not needed here.
            // Supabase SDK lets you pass a path:
            // NOTE: if your supabase-js version doesn't support `path`,
            // we’ll do the fetch() approach next.
            path: `?category=${encodeURIComponent(
              category
            )}&provider=${encodeURIComponent(provider)}`,
          } as any
        );

        if (cancelled) return;

        if (error) throw new Error(error.message);

        const list = data?.products ?? [];
        setProducts(list);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load products");
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [provider, category]);

  return { products, loading, error };
}

