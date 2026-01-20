import { serve } from "https://deno.land/std/http/server.ts";

/**
 * Safe Paystack Bills helper.
 *
 * This is intentionally NOT a generic proxy.
 * Only allowlisted endpoints/actions are supported.
 */

type Action = "categories" | "providers";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json(405, { success: false, message: "Method not allowed" });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) {
      // We don't verify user here, but requiring auth prevents accidental public exposure.
      return json(401, { success: false, message: "Please sign in to continue." });
    }

    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return json(400, { success: false, message: "Invalid request." });
    }

    const action = String(payload?.action ?? "").trim() as Action;
    if (action !== "categories" && action !== "providers") {
      return json(400, { success: false, message: "Unsupported action." });
    }

    const url =
      action === "categories"
        ? "https://api.paystack.co/bill/categories"
        : "https://api.paystack.co/bill/providers";

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || result?.status !== true) {
      return json(502, {
        success: false,
        message: "We couldn’t complete your request right now. Please try again shortly.",
        provider_response: result,
      });
    }

    return json(200, { success: true, data: result?.data ?? result });
  } catch (e) {
    console.error("paystack-bills error", e);
    return json(500, {
      success: false,
      message: "We couldn’t complete your request right now. Please try again.",
    });
  }
});
