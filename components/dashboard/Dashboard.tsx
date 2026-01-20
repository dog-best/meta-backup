import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import DashboardHeader from "./DashboardHeader";
import RecentActivity from "./RecentActivity";
import UtilitySection from "./UtilitySection";
import WalletOverview from "./WalletOverview";

import FundWalletModal from "@/components/wallet/FundWalletModal";
import SendMoneyModal from "@/components/wallet/SendMoneyModal";
import WithdrawWalletModal from "@/components/wallet/WithdrawWalletModal";

import { useLedger } from "@/hooks/wallet/useLedger";
import { useWallet } from "@/hooks/wallet/useWallet";

export default function Dashboard() {
  const { balance, loading: walletLoading, error: walletError, refetch: refetchWallet } = useWallet();
  const { entries, loading: ledgerLoading, refetch: refetchLedger } = useLedger(10);

  const [fundOpen, setFundOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const refreshing = useMemo(() => walletLoading || ledgerLoading, [walletLoading, ledgerLoading]);

  const onRefresh = async () => {
    await Promise.allSettled([refetchWallet(), refetchLedger()]);
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DashboardHeader />

        <View className="px-4 mt-4">
          <WalletOverview
            balance={balance}
            loading={walletLoading}
            error={walletError}
            onFund={() => setFundOpen(true)}
            onSend={() => setSendOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
          />

          <UtilitySection />

          <RecentActivity entries={entries} loading={ledgerLoading} />
        </View>
      </ScrollView>

      {/* Modals */}
      <FundWalletModal visible={fundOpen} onClose={() => setFundOpen(false)} />
      <SendMoneyModal visible={sendOpen} onClose={() => setSendOpen(false)} />
      <WithdrawWalletModal visible={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </View>
  );
}
