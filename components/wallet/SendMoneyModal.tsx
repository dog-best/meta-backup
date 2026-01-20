import { useWalletActions } from "@/hooks/wallet/useWalletActions";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SendMoneyModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { sendMoney } = useWalletActions();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = recipient.trim();
    const numericAmount = Number(amount);

    if (!cleaned || !amount) {
      Alert.alert("Error", "Recipient and amount are required");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("Error", "Invalid amount");
      return;
    }

    try {
      setLoading(true);
      await sendMoney(cleaned, numericAmount);
      Alert.alert("Success", "Transfer successful");

      onClose();
      setRecipient("");
      setAmount("");
    } catch (err: any) {
      Alert.alert("Transfer failed", err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-black rounded-t-2xl p-5">
          <Text className="text-white text-lg font-semibold mb-4">Send Money</Text>

          <Text className="text-gray-400 text-sm mb-1">
            Recipient (Public UID or 10-digit Account Number)
          </Text>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            placeholder="e.g. 9F7KQ2XM or 0123456789"
            placeholderTextColor="#666"
            className="bg-gray-900 text-white rounded-lg p-3 mb-4"
          />

          <Text className="text-gray-400 text-sm mb-1">Amount (NGN)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#666"
            className="bg-gray-900 text-white rounded-lg p-3 mb-6"
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={loading}
            className="bg-green-600 rounded-xl py-4"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold">Send Money</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="mt-4">
            <Text className="text-gray-400 text-center">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
