import { supabase } from "@/supabase/client";

export type Listing = {
  id: string;
  title: string;
  description?: string | null;
  price_ngn: number;
  currency: "NGN";
  image_url?: string | null;
};

export type Order = {
  id: string;
  listing_id: string;
  status: "pending" | "in_escrow" | "delivered" | "released" | "cancelled";
  amount_ngn: number;
};

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("market_listings")
    .select("id,title,description,price_ngn,currency,image_url")
    .order("created_at", { ascending: false });

  if (error) {
    // fallback: empty; UI will show placeholder
    return [];
  }
  return (data ?? []) as Listing[];
}

export async function createListing(payload: {
  title: string;
  description?: string;
  price_ngn: number;
  image_url?: string;
}) {
  const { data, error } = await supabase.functions.invoke("market-create-listing", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export async function createOrder(payload: { listing_id: string; payment_method: "wallet" | "crypto" }) {
  const { data, error } = await supabase.functions.invoke("market-create-order", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export async function approveDelivery(order_id: string) {
  const { data, error } = await supabase.functions.invoke("market-approve-delivery", {
    body: { order_id },
  });
  if (error) throw error;
  return data;
}

export async function fetchMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("market_orders")
    .select("id,listing_id,status,amount_ngn")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Order[];
}
