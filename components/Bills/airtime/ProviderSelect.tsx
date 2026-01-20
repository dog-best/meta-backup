import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

interface Provider {
  code: string;
  name: string;
}

interface ProviderSelectProps {
  providers: Provider[];
  value: string;
  onChange: (code: string) => void;
}

export default function ProviderSelect({
  providers,
  value,
  onChange,
}: ProviderSelectProps) {
  return (
    <View>
      <Text className="mb-2 font-medium">Select Network</Text>

      <FlatList<Provider>
        data={providers}
        horizontal
        keyExtractor={(item) => item.code}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onChange(item.code)}
            className={`px-4 py-2 border rounded-xl mr-2 ${
              value === item.code
                ? "bg-blue-600 border-blue-700"
                : "bg-white"
            }`}
          >
            <Text
              className={
                value === item.code ? "text-white" : "text-black"
              }
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
