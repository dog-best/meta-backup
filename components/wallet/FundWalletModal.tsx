import { useVirtualAccount } from "@/hooks/wallet/useVirtualAccount";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from "react-native";

export default function FundWalletModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { account, loading, error, refetch } = useVirtualAccount();

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-white rounded-t-2xl p-5">
          <Text className="text-lg font-semibold">Fund Wallet</Text>
          <Text className="text-gray-500 mt-1">
            Transfer to this account. Your wallet updates automatically.
          </Text>

          {loading ? (
            <ActivityIndicator className="mt-6" />
          ) : error ? (
            <View className="mt-6">
              <Text className="text-red-500">{error}</Text>
              <TouchableOpacity onPress={refetch} className="mt-3 bg-black rounded-xl p-3">
                <Text className="text-white text-center">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : account ? (
            <View className="mt-6 bg-gray-100 rounded-xl p-4">
              <Row label="Bank" value={account.bank_name} />
              <Row label="Account Name" value={account.account_name} />

              <View className="mt-3">
                <Text className="text-gray-600 text-xs">Account Number</Text>
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-xl font-bold">{account.account_number}</Text>
                  <TouchableOpacity
                    onPress={() => copy(account.account_number)}
                    className="bg-black px-3 py-2 rounded-lg"
                  >
                    <Text className="text-white">Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text className="text-gray-500 mt-4 text-xs">
                Only transfer in NGN. Deposits may take a short time to reflect.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={onClose} className="mt-5">
            <Text className="text-center text-gray-600">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-200">
      <Text className="text-gray-600">{label}</Text>
      <Text className="font-medium">{value}</Text>
    </View>
  );
}

