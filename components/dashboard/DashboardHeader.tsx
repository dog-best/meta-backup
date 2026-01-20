import { useAuth } from "@/hooks/authenication/useAuth";
import React from "react";
import { Text, View } from "react-native";

export default function DashboardHeader() {
  const { user } = useAuth();

  const name =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")?.[0] ||
    "Welcome";

  return (
    <View className="px-4 pt-6">
      <Text className="text-white text-2xl font-bold">Hi, {name}</Text>
      <Text className="text-gray-400 mt-1">
        Manage your wallet, pay bills, and send money.
      </Text>

      <View className="mt-5 h-[1px] bg-white/10" />
    </View>
  );
}
