import { useAuth } from "@/hooks/authenication/useAuth";
import { supabase } from "@/supabase/client";
import React, { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";

export default function DashboardHeader() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const name =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")?.[0] ||
    "Welcome";

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // useAuth should react automatically to auth state change
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="px-4 pt-6">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">Hi, {name}</Text>
          <Text className="text-gray-400 mt-1">
            Manage your wallet, pay bills, and send money.
          </Text>
        </View>

        <Pressable
          onPress={handleLogout}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-white/10"
        >
          {loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="text-white text-sm">Logout</Text>
          )}
        </Pressable>
      </View>

      <View className="mt-5 h-[1px] bg-white/10" />
    </View>
  );
}
