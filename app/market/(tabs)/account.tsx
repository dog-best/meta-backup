import React from "react";
import { Link } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function MarketAccount() {
  return (
    <View className="flex-1 bg-white p-4 gap-3">
      <Text className="text-xl font-semibold">Market Account</Text>
      <Text className="text-gray-600">
        This is a placeholder for seller verification, payout settings, and KYC.
      </Text>

      <Link href="/" asChild>
        <TouchableOpacity className="bg-black rounded-xl p-4 mt-4">
          <Text className="text-white text-center font-semibold">Back to Pay</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
