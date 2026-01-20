import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

type Tile = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
};

export default function UtilitySection() {
  const router = useRouter();

  const tiles: Tile[] = [
    { label: "Data", icon: "wifi", href: "/data" as Href },
    { label: "Airtime", icon: "call", href: "/airtime" as Href },
    { label: "Electricity", icon: "flash", href: "/electricity" as Href },
    { label: "Betting", icon: "football", href: "/betting" as Href },
    { label: "Crypto", icon: "logo-bitcoin", href: "/crypto" as Href },
    { label: "Market", icon: "cart", href: "/market" as Href },
  ];

  return (
    <View className="mt-6">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-white text-lg font-bold">Services</Text>
        <Text className="text-gray-400 text-sm">Tap to open</Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {tiles.map((t) => (
          <TouchableOpacity
            key={t.label}
            onPress={() => router.push(t.href)}
            className="w-[48%] bg-white/10 border border-white/10 rounded-2xl p-4"
          >
            <View className="w-10 h-10 rounded-xl bg-[#6D28D9]/30 items-center justify-center">
              <Ionicons name={t.icon} size={20} color="white" />
            </View>

            <Text className="text-white font-semibold mt-3">{t.label}</Text>
            <Text className="text-gray-400 text-xs mt-1">Fast & secure</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
