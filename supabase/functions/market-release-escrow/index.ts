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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { escrow_id } = await req.json();
    const escId = String(escrow_id ?? "").trim();
    if (!escId) return json(400, { success: false, message: "Escrow is required" });

    await admin.from("market_escrows").update({ status: "released" }).eq("id", escId);
    return json(200, { success: true, escrow_id: escId, status: "released" });
  } catch {
    return json(500, { success: false, message: "We couldn’t complete your request right now. Please try again." });
  }
});
