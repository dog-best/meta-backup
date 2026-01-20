import type { LedgerEntry } from "@/hooks/wallet/useLedger";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function RecentActivity({
  entries,
  loading,
}: {
  entries: LedgerEntry[];
  loading: boolean;
}) {
  return (
    <View className="mt-7">
      <Text className="text-white text-lg font-bold mb-3">Recent Activity</Text>

      <View className="bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <View className="p-5">
            <ActivityIndicator color="#fff" />
          </View>
        ) : entries.length === 0 ? (
          <View className="p-5">
            <Text className="text-gray-300">No transactions yet.</Text>
          </View>
        ) : (
          entries.map((e, idx) => {
            const isCredit = e.direction === "credit";
            const sign = isCredit ? "+" : "-";
            const amount = Number(e.amount ?? 0).toLocaleString();
            const ref = String(e.reference ?? "").slice(0, 18);

            return (
              <View
                key={e.id}
                className={`p-4 ${idx !== 0 ? "border-t border-white/10" : ""}`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-white font-semibold">
                    {isCredit ? "Credit" : "Debit"}
                  </Text>
                  <Text className={isCredit ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                    {sign} ₦{amount}
                  </Text>
                </View>

                <Text className="text-gray-400 text-xs mt-1">
                  Ref: {ref}...
                </Text>

                <Text className="text-gray-500 text-xs mt-1">
                  {new Date(e.created_at).toLocaleString()}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
