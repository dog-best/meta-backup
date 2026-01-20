import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import AirtimeModal from "../Bills/airtime/AirtimeModal";
import DataModal from "../Bills/data/DataModal";

export default function ServicesGrid() {
  const [airtimeVisible, setAirtimeVisible] = useState(false);
  const [dataVisible, setDataVisible] = useState(false);

  return (
    <View className="mt-4">
      <View className="flex-row justify-between">
        <TouchableOpacity
          onPress={() => setAirtimeVisible(true)}
          className="bg-gray-100 p-4 rounded-lg flex-1 mr-2"
        >
          <Text className="font-medium">Airtime</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setDataVisible(true)}
          className="bg-gray-100 p-4 rounded-lg flex-1 ml-2"
        >
          <Text className="font-medium">Data</Text>
        </TouchableOpacity>
      </View>

      <AirtimeModal
        visible={airtimeVisible}
        onClose={() => setAirtimeVisible(false)}
      />

      <DataModal
        visible={dataVisible}
        onClose={() => setDataVisible(false)}
      />
    </View>
  );
}
