import { useMarket } from "@/services/market/useMarket";
import { Link } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function MarketHome() {
  const { loading, error, listings, placeOrder } = useMarket();

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl font-semibold">BestCity Market</Text>
        <Link href="/market/(tabs)/sell" asChild>
          <TouchableOpacity className="bg-black px-3 py-2 rounded-xl">
            <Text className="text-white font-semibold">Sell</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {error && <Text className="text-red-500 mb-2">{error}</Text>}

      {loading && listings.length === 0 ? (
        <View className="py-6"><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={
            <View className="py-12">
              <Text className="text-gray-500 text-center">No listings yet. Create one from Sell tab.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="border rounded-2xl p-4 mb-3">
              <Text className="text-lg font-semibold">{item.title}</Text>
              {!!item.description && <Text className="text-gray-600 mt-1">{item.description}</Text>}
              <Text className="mt-2 font-bold">₦{Number(item.price_ngn).toLocaleString()}</Text>

              <TouchableOpacity
                className="mt-3 bg-blue-600 rounded-xl p-3"
                onPress={async () => {
                  try {
                    await placeOrder(item.id, "wallet");
                  } catch {}
                }}
              >
                <Text className="text-white text-center font-semibold">Pay (Escrow)</Text>
              </TouchableOpacity>

              <Text className="text-gray-500 text-xs mt-2">
                Payment is held in escrow until buyer approves delivery.
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
