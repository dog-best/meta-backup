import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export function setupNotificationHandler() {
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function initNotifications() {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("vad-mining", {
      name: "VAD Mining",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function notifyMiningComplete() {
  if (Platform.OS === "web") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⛏️ Mining Complete",
      body: "Your 4.8 VAD is ready. Open the app to claim and keep mining!",
      sound: true,
    },
    trigger: null,
  });
}
