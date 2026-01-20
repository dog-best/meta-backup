import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

type Provider = {
  code: string;
  name: string;
};

type ProviderSelectProps = {
  providers: Provider[];
  value: string; // currently selected provider code
  onChange: (code: string) => void;
};

export default function ProviderSelect({
  providers,
  value,
  onChange,
}: ProviderSelectProps) {
  if (!providers || providers.length === 0) return null;

  return (
    <View>
      <Text className="mb-2 font-medium">Select Network</Text>

      <FlatList
        data={providers}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => {
          const isSelected = item.code === value;

          return (
            <TouchableOpacity
              onPress={() => onChange(item.code)}
              className={`px-4 py-2 border rounded-xl mr-2 ${
                isSelected ? "bg-blue-600 border-blue-700" : "bg-white border-gray-300"
              }`}
            >
              <Text className={isSelected ? "text-white font-medium" : "text-black"}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
