import WalletActions from "@/components/wallet/WalletActions";
import WalletBalance from "@/components/wallet/WalletBalance";
import WalletTransactionList from "@/components/wallet/WalletTransactionList";
import { ScrollView, Text } from "react-native";

export default function WalletScreen() {
  return (
    <ScrollView className="flex-1 bg-black px-4 pt-6">
      <Text className="text-white text-xl font-bold mb-4">My Wallet</Text>

      <WalletBalance />
      <WalletActions />

      <Text className="text-white text-lg font-semibold mb-2">
        Recent Transactions
      </Text>
      <WalletTransactionList />
    </ScrollView>
  );
}
