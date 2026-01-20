import { useMarket } from "@/services/market/useMarket";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function MarketSell() {
  const { loading, error, addListing } = useMarket();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const canSubmit = useMemo(() => {
    const n = Number(price);
    return title.trim().length > 2 && Number.isFinite(n) && n > 0 && !loading;
  }, [title, price, loading]);

  const submit = async () => {
    try {
      await addListing({
        title: title.trim(),
        description: description.trim() || undefined,
        price_ngn: Number(price),
      });
      Alert.alert("Success", "Listing created");
      setTitle("");
      setDescription("");
      setPrice("");
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not create listing");
    }
  };

  return (
    <View className="flex-1 bg-white p-4 gap-3">
      <Text className="text-xl font-semibold">Sell</Text>

      <TextInput
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
        className="border p-3 rounded-xl"
      />

      <TextInput
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        className="border p-3 rounded-xl"
        multiline
      />

      <TextInput
        placeholder="Price (₦)"
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
        className="border p-3 rounded-xl"
      />

      {error && <Text className="text-red-500">{error}</Text>}

      <TouchableOpacity
        disabled={!canSubmit}
        onPress={submit}
        className={`rounded-xl p-4 ${canSubmit ? "bg-black" : "bg-gray-300"}`}
      >
        {loading ? <ActivityIndicator /> : <Text className="text-white text-center font-semibold">Create Listing</Text>}
      </TouchableOpacity>

      <Text className="text-gray-500 text-xs">
        Listings require Market tables + Edge Functions to be deployed in your Supabase project.
      </Text>
    </View>
  );
}
