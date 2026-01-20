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

    const { listing_id, payment_method } = await req.json();
    const listingId = String(listing_id ?? "").trim();
    const method = (payment_method === "crypto" ? "crypto" : "wallet") as "wallet" | "crypto";

    if (!listingId) return json(400, { success: false, message: "Listing is required" });

    // Load listing
    const { data: listing, error: lErr } = await admin
      .from("market_listings")
      .select("id,seller_id,price_ngn,status")
      .eq("id", listingId)
      .maybeSingle();

    if (lErr || !listing || listing.status !== "active") {
      return json(404, { success: false, message: "Listing not found" });
    }
    if (listing.seller_id === user.id) {
      return json(400, { success: false, message: "You cannot buy your own listing" });
    }

    // NOTE: For production settlement, you should debit buyer wallet here (ledger_entries) or lock funds.
    // This MVP flow creates an escrow record and marks order as in_escrow.

    const { data: order, error: oErr } = await admin
      .from("market_orders")
      .insert({
        buyer_id: user.id,
        seller_id: listing.seller_id,
        listing_id: listing.id,
        amount_ngn: listing.price_ngn,
        status: "in_escrow",
        payment_method: method,
      })
      .select("id")
      .single();

    if (oErr || !order) return json(500, { success: false, message: "Could not create order" });

    const { error: eErr } = await admin
      .from("market_escrows")
      .insert({
        order_id: order.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount_ngn: listing.price_ngn,
        status: "held",
      });

    if (eErr) return json(500, { success: false, message: "Could not start escrow" });

    return json(200, { success: true, order_id: order.id, status: "in_escrow" });
  } catch {
    return json(500, { success: false, message: "We couldn’t complete your request right now. Please try again." });
  }
});
