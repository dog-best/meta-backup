import { useLedger } from "@/hooks/wallet/useLedger";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

export default function WalletTransactionList() {
  const { entries, loading, error } = useLedger(20);

  if (loading) {
    return <ActivityIndicator className="mt-4" />;
  }

  if (error) {
    return <Text className="text-red-400 mt-4">{error}</Text>;
  }

  if (!entries.length) {
    return <Text className="text-gray-400 mt-4">No transactions yet</Text>;
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View className="flex-row justify-between py-3 border-b border-gray-800">
          <View>
            <Text className="text-white font-medium capitalize">
              {item.metadata?.type || "Transaction"}
            </Text>
            <Text className="text-gray-500 text-xs">
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>

          <Text
            className={`font-semibold ${
              item.direction === "credit"
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {item.direction === "credit" ? "+" : "-"}₦
            {item.amount.toLocaleString()}
          </Text>
        </View>
      )}
    />
  );
}
