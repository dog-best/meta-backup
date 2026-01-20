import { supabase } from "@/supabase/client";
import { useState } from "react";

type AirtimePayload = {
  phone: string;
  provider: string;
  amount: number;
  reference: string;
};

type DataPayload = {
  phone: string;
  provider: string;
  product_code: string;
  reference: string;
};

type ElectricityPayload = {
  disco: string; // e.g. ikeja, eko, phed
  meter_number: string;
  meter_type: "prepaid" | "postpaid";
  amount: number;
  reference: string;
};

type BettingPayload = {
  operator: string; // e.g. bet9ja, sportybet
  customer_id: string; // betting account ID / phone
  amount: number;
  reference: string;
};

function getFriendlyMessage(err: any): string {
  // supabase-js FunctionsError typically has:
  // err.message = "Edge Function returned a non-2xx status code"
  // err.context = { status, statusText, body }
  const status = err?.context?.status as number | undefined;

  // body might be a string or already parsed
  const body = err?.context?.body;
  let parsed: any = null;

  if (body) {
    if (typeof body === "string") {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = null;
      }
    } else if (typeof body === "object") {
      parsed = body;
    }
  }

  // If backend returned safe JSON, use it
  if (parsed?.message && typeof parsed.message === "string") {
    return parsed.message;
  }

  // Fallbacks (still no Supabase mentions)
  if (status === 401) return "Please sign in to continue.";
  if (status === 402) return "Insufficient wallet balance. Please fund your wallet and try again.";
  if (status === 409) return "This transaction is already in progress. Please wait.";
  if (status && status >= 500) return "We couldn’t complete your request right now. Please try again.";

  return "Something went wrong. Please try again.";
}

export function useMakePurchase() {
  const [loading, setLoading] = useState(false);

  const buyAirtime = async (payload: AirtimePayload) => {
    if (loading) throw new Error("Please wait…");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("paystack-airtime", {
        body: payload,
      });

      if (error) {
        throw new Error(getFriendlyMessage(error));
      }

      if (!data?.success) {
        // If your function ever returns 200 with success:false
        throw new Error(data?.message ?? "We couldn’t complete your request right now. Please try again.");
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const buyData = async (payload: DataPayload) => {
    if (loading) throw new Error("Please wait…");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("paystack-data", {
        body: payload,
      });

      if (error) {
        throw new Error(getFriendlyMessage(error));
      }

      if (!data?.success) {
        throw new Error(data?.message ?? "We couldn’t complete your request right now. Please try again.");
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const payElectricity = async (payload: ElectricityPayload) => {
    if (loading) throw new Error("Please wait…");
    setLoading(true);

    try {
      // Uses your generic bills pipeline
      const { data, error } = await supabase.functions.invoke("pay-bill", {
        body: {
          category: "electricity",
          ...payload,
        },
      });

      if (error) throw new Error(getFriendlyMessage(error));
      if (!data?.success) throw new Error(data?.message ?? "We couldn’t complete your request right now. Please try again.");
      return data;
    } finally {
      setLoading(false);
    }
  };

  const fundBetting = async (payload: BettingPayload) => {
    if (loading) throw new Error("Please wait…");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("pay-bill", {
        body: {
          category: "betting",
          ...payload,
        },
      });

      if (error) throw new Error(getFriendlyMessage(error));
      if (!data?.success) throw new Error(data?.message ?? "We couldn’t complete your request right now. Please try again.");
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { buyAirtime, buyData, payElectricity, fundBetting, loading };
}
