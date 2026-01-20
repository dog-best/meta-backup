import { useMarket } from "@/services/market/useMarket";
import React, { useEffect } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function MarketOrders() {
  const { loading, error, orders, refreshOrders, approve } = useMarket();

  useEffect(() => {
    refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-semibold mb-4">Orders</Text>

      {error && <Text className="text-red-500 mb-2">{error}</Text>}

      {loading && orders.length === 0 ? (
        <View className="py-6"><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text className="text-gray-500">No orders yet.</Text>}
          renderItem={({ item }) => (
            <View className="border rounded-2xl p-4 mb-3">
              <Text className="font-semibold">Order #{item.id.slice(0, 8)}</Text>
              <Text className="mt-1">Amount: ₦{Number(item.amount_ngn).toLocaleString()}</Text>
              <Text className="mt-1 text-gray-600">Status: {item.status}</Text>

              {item.status === "in_escrow" && (
                <TouchableOpacity
                  className="mt-3 bg-black rounded-xl p-3"
                  onPress={async () => {
                    try {
                      await approve(item.id);
                    } catch {}
                  }}
                >
                  <Text className="text-white text-center font-semibold">Service Approved (Release)</Text>
                </TouchableOpacity>
              )}

              <Text className="text-gray-500 text-xs mt-2">
                Escrow flow: Pay → Held → Approve → Released.
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
