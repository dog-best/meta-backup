import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import FundWalletModal from "./FundWalletModal";
import WithdrawWalletModal from "./WithdrawWalletModal";

export default function WalletActions() {
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  return (
    <>
      <View className="flex-row justify-between mb-6">
        <ActionButton label="Fund" onPress={() => setShowFund(true)} />
        <ActionButton label="Send" disabled />
        <ActionButton label="Withdraw" onPress={() => setShowWithdraw(true)} />
      </View>

      <FundWalletModal visible={showFund} onClose={() => setShowFund(false)} />
      <WithdrawWalletModal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
      />
    </>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      className={`flex-1 mx-1 py-3 rounded-xl ${
        disabled ? "bg-gray-700" : "bg-green-600"
      }`}
    >
      <Text className="text-white text-center font-semibold">{label}</Text>
    </TouchableOpacity>
  );
}
