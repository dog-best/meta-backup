import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

export type BundleProduct = {
  product_code: string;
  name: string;
  has_offer: boolean;
  base_price: number;
  final_price: number;
  bonus_data_mb: number;
  cashback?: number;
  validity_label?: string | null;
  data_size_mb?: number | null;
};

type BundleListProps = {
  products: BundleProduct[];
  onSelect: (product: BundleProduct) => void;
};

export default function BundleList({ products, onSelect }: BundleListProps) {
  return (
    <FlatList<BundleProduct>
      data={products}
      keyExtractor={(item) => item.product_code}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onSelect(item)}
          className="border p-4 rounded-xl mb-2"
        >
          <Text className="font-semibold">{item.name}</Text>

          <View className="flex-row gap-2 mt-1 flex-wrap">
            {item.has_offer ? (
              <>
                <Text className="line-through text-gray-500">
                  ₦{Number(item.base_price).toLocaleString()}
                </Text>
                <Text className="text-green-600 font-bold">
                  ₦{Number(item.final_price).toLocaleString()}
                </Text>

                {Number(item.bonus_data_mb) > 0 && (
                  <Text className="text-orange-600">
                    + {Number(item.bonus_data_mb).toLocaleString()}MB bonus
                  </Text>
                )}
              </>
            ) : (
              <Text className="font-bold">
                ₦{Number(item.final_price).toLocaleString()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
