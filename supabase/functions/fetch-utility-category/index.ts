import { serve } from "https://deno.land/std/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category"); // data | airtime
    const provider = url.searchParams.get("provider"); // mtn | airtel

    if (!category || !provider) {
      return json(400, { success: false, message: "Missing category or provider" });
    }

    const now = new Date();

    // Products are static rows in service_products; offers are optional time-bounded rows in service_offers.
    const { data: products, error: productsErr } = await supabaseAdmin
      .from("service_products")
      .select("product_code, name, data_size_mb, validity_label, base_price, provider, category, active")
      .eq("category", category)
      .eq("provider", provider)
      .eq("active", true)
      .order("base_price", { ascending: true });

    if (productsErr) {
      console.error("fetch-utility-category productsErr", productsErr);
      return json(500, { success: false, message: "Failed to load products" });
    }

    const { data: offers, error: offersErr } = await supabaseAdmin
      .from("service_offers")
      .select("provider, category, product_code, cashback, bonus_data_mb, starts_at, ends_at, active")
      .eq("category", category)
      .eq("provider", provider)
      .eq("active", true);

    if (offersErr) {
      console.error("fetch-utility-category offersErr", offersErr);
      // Not fatal; proceed without offers
    }

    const offerList = offers ?? [];

    const enriched = (products ?? []).map((p: any) => {
      const base_price = Number(p.base_price ?? 0);
      const bestOffer = offerList
        .filter((o: any) => o.product_code === p.product_code)
        .filter((o: any) => {
          const startOk = !o.starts_at || new Date(o.starts_at) <= now;
          const endOk = !o.ends_at || new Date(o.ends_at) >= now;
          return startOk && endOk;
        })
        .sort((a: any, b: any) => Number(b.cashback ?? 0) - Number(a.cashback ?? 0))[0];

      const cashback = Number(bestOffer?.cashback ?? 0);
      const final_price = Math.max(0, base_price - cashback);

      return {
        product_code: p.product_code,
        name: p.name,
        data_size_mb: p.data_size_mb,
        validity_label: p.validity_label,
        has_offer: !!bestOffer,
        base_price,
        final_price,
        cashback,
        bonus_data_mb: Number(bestOffer?.bonus_data_mb ?? 0),
      };
    });

    return json(200, { success: true, products: enriched });
  } catch (e) {
    console.error("fetch-utility-category error", e);
    return json(500, { success: false, message: "Unexpected error" });
  }
});
