import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  try {
    // ✅ Only allow POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { amount, email } = body;

    // ✅ Validate input
    if (
      !amount ||
      typeof amount !== "number" ||
      amount <= 0 ||
      !email ||
      typeof email !== "string"
    ) {
      return new Response("Invalid payload", { status: 400 });
    }

    // ✅ Initialize Paystack transaction
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // NGN → kobo
        email,
        currency: "NGN",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Paystack init failed:", data);
      return new Response("Paystack error", { status: 502 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paystack-init error:", err);
    return new Response("Server error", { status: 500 });
  }
});
