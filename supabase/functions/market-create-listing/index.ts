import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { success: false, message: "Method not allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user || authError) return json(401, { success: false, message: "Unauthorized" });

    const { title, description, price_ngn, image_url } = await req.json();

    const t = String(title ?? "").trim();
    const d = description ? String(description).trim() : null;
    const price = Number(price_ngn);

    if (t.length < 3) return json(400, { success: false, message: "Title is required" });
    if (!Number.isFinite(price) || price <= 0) return json(400, { success: false, message: "Invalid price" });

    const { data, error } = await admin
      .from("market_listings")
      .insert({
        seller_id: user.id,
        title: t,
        description: d,
        price_ngn: price,
        currency: "NGN",
        image_url: image_url ? String(image_url) : null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return json(500, { success: false, message: "Could not create listing" });
    }

    return json(200, { success: true, listing_id: data.id });
  } catch {
    return json(500, { success: false, message: "We couldn’t complete your request right now. Please try again." });
  }
});
