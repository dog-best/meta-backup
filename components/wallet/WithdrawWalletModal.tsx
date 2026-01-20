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

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function WithdrawWalletModal({ visible, onClose }: Props) {
  const { withdraw } = useWalletActions();

  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    const numericAmount = Number(amount);

    if (!amount || !bankCode || !accountNumber) {
      Alert.alert("Missing fields", "Please fill amount, bank code, and account number.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount.");
      return;
    }

    if (!/^\d{10}$/.test(accountNumber.trim())) {
      Alert.alert("Invalid account number", "Account number must be 10 digits.");
      return;
    }

    try {
      setLoading(true);

      const res = await withdraw(
        numericAmount,
        bankCode.trim(),
        accountNumber.trim(),
        accountName.trim() || undefined
      );

      Alert.alert(
        "Withdrawal started",
        `Reference: ${res?.reference ?? "N/A"}\nStatus: ${res?.status ?? "processing"}`
      );

      onClose();
      setAmount("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (err: any) {
      Alert.alert("Withdrawal failed", err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white p-5 rounded-t-2xl">
          <Text className="text-lg font-semibold mb-4">Withdraw to Bank</Text>

          <TextInput
            placeholder="Amount (NGN)"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            className="border p-3 rounded mb-3"
          />

          <TextInput
            placeholder="Bank Code (e.g. 058)"
            value={bankCode}
            onChangeText={setBankCode}
            className="border p-3 rounded mb-3"
          />

          <TextInput
            placeholder="Account Number (10 digits)"
            keyboardType="numeric"
            value={accountNumber}
            onChangeText={setAccountNumber}
            className="border p-3 rounded mb-3"
          />

          <TextInput
            placeholder="Account Name (optional)"
            value={accountName}
            onChangeText={setAccountName}
            className="border p-3 rounded mb-4"
          />

          <TouchableOpacity
            onPress={handleWithdraw}
            disabled={loading}
            className="bg-primary py-4 rounded items-center"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Withdraw</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="mt-4 items-center">
            <Text className="text-gray-500">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
