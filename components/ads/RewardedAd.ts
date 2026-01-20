// components/RewardedAd.ts
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";

export async function showRewardedAd(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  const unitId = __DEV__
    ? TestIds.REWARDED
    : "ca-app-pub-4533962949749202/1804000824";

  const rewarded = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve) => {
    let finished = false;
    let showed = false;

    const unsubscribers: (() => void)[] = [];

    const cleanup = () => {
      unsubscribers.forEach((u) => u());
    };

    unsubscribers.push(
      rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          showed = true;
          rewarded.show();
        }
      )
    );

    unsubscribers.push(
      rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          if (finished) return;
          finished = true;
          cleanup();

          // ✅ TRUST CLOSE IF AD WAS SHOWN
          resolve(showed);
        }
      )
    );

    unsubscribers.push(
      rewarded.addAdEventListener(
        AdEventType.ERROR,
        (err) => {
          console.log("Rewarded ad error:", err);
          if (finished) return;
          finished = true;
          cleanup();
          resolve(false);
        }
      )
    );

    rewarded.load();
  });
}

