import { useWallet } from "@/hooks/wallet/useWallet";
import { useWalletActions } from "@/hooks/wallet/useWalletActions";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function SendWalletModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { sendMoney } = useWalletActions();
  const { refetch: refetchWallet } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRecipient("");
      setAmount("");
      setLoading(false);
    }
  }, [visible]);

  const onSend = async () => {
    try {
      setLoading(true);
      const amt = Number(amount);
      const res = await sendMoney(recipient, amt);
      await refetchWallet();
      Alert.alert("Success", `Transfer sent (ref: ${res?.reference ?? ""})`);
      onClose();
    } catch (e: any) {
      Alert.alert("Transfer failed", e?.message ?? "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>Send Money</Text>
          <Text style={{ marginTop: 4, color: "#6B7280" }}>Send to a BestCity ID or a 10-digit account number.</Text>

          <Text style={{ marginTop: 16, color: "#374151", fontSize: 12 }}>Recipient</Text>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Public UID or 10-digit account"
            autoCapitalize="characters"
            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, marginTop: 6 }}
          />

          <Text style={{ marginTop: 12, color: "#374151", fontSize: 12 }}>Amount (NGN)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="1000"
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, marginTop: 6 }}
          />

          <TouchableOpacity
            onPress={onSend}
            disabled={loading}
            style={{ backgroundColor: loading ? "#9CA3AF" : "#16A34A", paddingVertical: 14, borderRadius: 14, marginTop: 16, alignItems: "center" }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "white", fontWeight: "700" }}>Send</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 14 }}>
            <Text style={{ textAlign: "center", color: "#6B7280" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}