import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DvaRow = {
  user_id: string;
  paystack_customer_code: string | null;
  paystack_dedicated_account_id: number | null;
  account_number: string;
  bank_name: string;
  account_name: string;
  currency: string;
  provider_slug: string | null;
  active: boolean;
  raw: any;
};

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    // user-scoped client (auth only)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: auth, error: authError } = await userClient.auth.getUser();
    const user = auth?.user;
    if (!user || authError) return new Response("Unauthorized", { status: 401 });

    // admin client (db writes)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) return existing DVA (active)
    const { data: existing } = await admin
      .from("user_virtual_accounts")
      .select(
        "user_id,paystack_customer_code,paystack_dedicated_account_id,account_number,bank_name,account_name,currency,provider_slug,active"
      )
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle<DvaRow>();

    if (existing?.account_number) {
      return json200({ success: true, account: pickAccount(existing) });
    }

    // 2) get profile
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile?.email) {
      return json400("User profile missing email");
    }

    // 3) If we have a previous customer_code (inactive record maybe), reuse it
    let customerCode: string | null = null;

    const { data: prev } = await admin
      .from("user_virtual_accounts")
      .select("paystack_customer_code")
      .eq("user_id", user.id)
      .not("paystack_customer_code", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ paystack_customer_code: string | null }>();

    if (prev?.paystack_customer_code) customerCode = prev.paystack_customer_code;

    // 4) Create Paystack customer if needed
    if (!customerCode) {
      const customerRes = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profile.email,
          first_name: profile.full_name?.split(" ")?.[0] ?? undefined,
          last_name: profile.full_name?.split(" ")?.slice(1).join(" ") ?? undefined,
        }),
      });

      const customerJson = await customerRes.json();
      if (!customerRes.ok || !customerJson?.status) {
        return json502("Paystack customer create failed", customerJson);
      }

      customerCode = customerJson.data.customer_code;
    }

    // 5) Create Dedicated Virtual Account
    const dvaRes = await fetch("https://api.paystack.co/dedicated_account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerCode,
        // optional: preferred_bank: "wema-bank"
      }),
    });

    const dvaJson = await dvaRes.json();
    if (!dvaRes.ok || !dvaJson?.status) {
      return json502("Paystack DVA create failed", dvaJson);
    }

    const accountNumber = dvaJson.data.account_number;
    const bankName = dvaJson.data.bank?.name ?? "Bank";
    const accountName = dvaJson.data.account_name ?? profile.full_name ?? profile.email;

    // 6) Store
    const { error: insErr } = await admin.from("user_virtual_accounts").insert({
      user_id: user.id,
      paystack_customer_code: customerCode,
      paystack_dedicated_account_id: dvaJson.data.id ?? null,
      account_number: accountNumber,
      bank_name: bankName,
      account_name: accountName,
      currency: "NGN",
      provider_slug: dvaJson.data.bank?.slug ?? null,
      active: true,
      raw: dvaJson.data,
    });

    if (insErr) {
      return json502("Failed to store virtual account", insErr);
    }

    return json200({
      success: true,
      account: {
        account_number: accountNumber,
        bank_name: bankName,
        account_name: accountName,
        currency: "NGN",
        active: true,
      },
    });
  } catch (e) {
    console.error("paystack-dva error:", e);
    return json500("Server error");
  }
});

function pickAccount(row: any) {
  return {
    account_number: row.account_number,
    bank_name: row.bank_name,
    account_name: row.account_name,
    currency: row.currency ?? "NGN",
    active: !!row.active,
  };
}

function json200(obj: any) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function json400(message: string) {
  return new Response(JSON.stringify({ success: false, message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
function json500(message: string) {
  return new Response(JSON.stringify({ success: false, message }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
function json502(message: string, raw: any) {
  return new Response(JSON.stringify({ success: false, message, raw }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

