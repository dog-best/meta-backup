import { useEffect, useState } from "react";
import { approveDelivery, createListing, createOrder, fetchListings, fetchMyOrders, Listing, Order } from "@/services/market/marketService";

function friendly(err: any) {
  const status = err?.context?.status;
  const body = err?.context?.body;
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    if (parsed?.message) return parsed.message;
  } catch {}
  if (status === 401) return "Please sign in to continue.";
  return "We couldn’t complete your request right now. Please try again.";
}

export function useMarket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const refreshListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchListings();
      setListings(data);
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyOrders();
      setOrders(data);
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async (listing_id: string, payment_method: "wallet" | "crypto") => {
    setLoading(true);
    setError(null);
    try {
      return await createOrder({ listing_id, payment_method });
    } catch (e: any) {
      const msg = friendly(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const addListing = async (payload: { title: string; description?: string; price_ngn: number; image_url?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const out = await createListing(payload);
      await refreshListings();
      return out;
    } catch (e: any) {
      const msg = friendly(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (order_id: string) => {
    setLoading(true);
    setError(null);
    try {
      const out = await approveDelivery(order_id);
      await refreshOrders();
      return out;
    } catch (e: any) {
      const msg = friendly(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loading, error, listings, orders, refreshListings, refreshOrders, placeOrder, addListing, approve };
}
