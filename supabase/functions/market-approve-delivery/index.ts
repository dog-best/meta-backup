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

    const { order_id } = await req.json();
    const orderId = String(order_id ?? "").trim();
    if (!orderId) return json(400, { success: false, message: "Order is required" });

    const { data: order } = await admin
      .from("market_orders")
      .select("id,buyer_id,status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.buyer_id !== user.id) {
      return json(404, { success: false, message: "Order not found" });
    }
    if (order.status !== "in_escrow") {
      return json(400, { success: false, message: "Order is not in escrow" });
    }

    // Mark delivered
    await admin.from("market_orders").update({ status: "delivered" }).eq("id", orderId);

    // Release escrow (can be async / background in production)
    const { data: esc } = await admin
      .from("market_escrows")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (esc?.id) {
      await admin.from("market_escrows").update({ status: "released" }).eq("id", esc.id);
      await admin.from("market_orders").update({ status: "released" }).eq("id", orderId);
    }

    // NOTE: For production settlement, also credit seller wallet via ledger (NGN) or crypto transfer.

    return json(200, { success: true, order_id: orderId, status: "released" });
  } catch {
    return json(500, { success: false, message: "We couldn’t complete your request right now. Please try again." });
  }
});
