import { serve } from "https://deno.land/std/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const category = url.searchParams.get("category"); // data | airtime
  const provider = url.searchParams.get("provider"); // mtn | airtel

  if (!category || !provider) {
    return new Response(
      JSON.stringify({ success: false, message: "Missing category or provider" }),
      { status: 400 }
    );
  }

  const now = new Date();

  const { data, error } = await supabaseAdmin
    .from("service_products")
    .select(`
      product_code,
      name,
      category_code,
      provider_code,
      data_size_mb,
      validity_label,
      active,
      service_offers (
        id,
        base_price,
        promo_price,
        cashback,
        bonus_data_mb,
        start_at,
        end_at,
        priority,
        active
      )
    `)
    .eq("active", true)
    .eq("category_code", category)
    .eq("provider_code", provider)
    .order("data_size_mb", { ascending: true });

  if (error || !data) {
    return new Response(
      JSON.stringify({ success: false, message: "Failed to load products" }),
      { status: 500 }
    );
  }

  const products = data.map((p) => {
    // Filter active + time-valid offers
    const validOffers = (p.service_offers ?? [])
      .filter((o) => o.active !== false)
      .filter((o) => {
        const startOk = !o.start_at || new Date(o.start_at) <= now;
        const endOk = !o.end_at || new Date(o.end_at) >= now;
        return startOk && endOk;
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const bestOffer = validOffers[0];

    const base_price = bestOffer?.base_price ?? 0;
    const final_price = bestOffer?.promo_price ?? bestOffer?.base_price ?? 0;

    return {
      product_code: p.product_code,
      name: p.name,
      data_size_mb: p.data_size_mb,
      validity_label: p.validity_label,
      has_offer: !!bestOffer,
      base_price,
      final_price,
      cashback: bestOffer?.cashback ?? 0,
      bonus_data_mb: bestOffer?.bonus_data_mb ?? 0,
    };
  });

  return new Response(
    JSON.stringify({ success: true, products }),
    { headers: { "Content-Type": "application/json" } }
  );
});
