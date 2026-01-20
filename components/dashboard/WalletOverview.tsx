import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type Props = {
  balance: number;
  loading: boolean;
  error: string | null;
  onFund: () => void;
  onSend: () => void;
  onWithdraw: () => void;
};

export default function WalletOverview({
  balance,
  loading,
  error,
  onFund,
  onSend,
  onWithdraw,
}: Props) {
  return (
    <View className="rounded-3xl overflow-hidden">
      {/* Card */}
      <View className="bg-[#6D28D9] p-5">
        <Text className="text-white/80 text-sm">Available Balance</Text>

        {loading ? (
          <View className="mt-3">
            <ActivityIndicator color="#fff" />
          </View>
        ) : error ? (
          <Text className="text-white mt-2">{error}</Text>
        ) : (
          <Text className="text-white text-3xl font-extrabold mt-2">
            ₦{Number(balance ?? 0).toLocaleString()}
          </Text>
        )}

        <View className="mt-4 flex-row gap-3">
          <ActionBtn label="Fund" icon="add-circle" onPress={onFund} />
          <ActionBtn label="Send" icon="arrow-up-circle" onPress={onSend} />
          <ActionBtn label="Withdraw" icon="arrow-down-circle" onPress={onWithdraw} />
        </View>
      </View>

      {/* Sub shadow strip */}
      <View className="bg-black/40 h-3" />
    </View>
  );
}

function ActionBtn({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 bg-white/15 rounded-2xl py-3 items-center flex-row justify-center gap-2"
    >
      <Ionicons name={icon} size={18} color="white" />
      <Text className="text-white font-semibold">{label}</Text>
    </TouchableOpacity>
  );
}
