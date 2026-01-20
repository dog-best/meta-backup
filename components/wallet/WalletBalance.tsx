import { useWallet } from "@/hooks/wallet/useWallet";
import { ActivityIndicator, Text, View } from "react-native";

export default function WalletBalance() {
  const { balance, loading, error } = useWallet();

  return (
    <View className="bg-black rounded-2xl p-5 mb-4">
      <Text className="text-gray-400 text-sm">Available Balance</Text>

      {loading ? (
        <ActivityIndicator color="#fff" className="mt-2" />
      ) : error ? (
        <Text className="text-red-400 mt-2">{error}</Text>
      ) : (
        <Text className="text-white text-3xl font-bold mt-2">
          ₦{balance.toLocaleString()}
        </Text>
      )}
    </View>
  );
}
