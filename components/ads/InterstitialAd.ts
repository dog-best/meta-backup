import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";

const IS_NATIVE =
  Platform.OS === "android" || Platform.OS === "ios";

export async function showInterstitial(): Promise<void> {
  if (!IS_NATIVE) {
    console.log("[Ad] Not native platform");
    return;
  }

  // ✅ Test ads in dev, real ads in production (SAFE)
  const unitId = __DEV__
    ? TestIds.INTERSTITIAL
    : "ca-app-pub-4533962949749202/2761859275";

  const interstitial = InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<void>((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      console.log("[Ad] Interstitial timeout — skipping");
      resolve(); // ✅ NEVER block app flow
    }, 8000);

    const cleanup = () => {
      clearTimeout(timeout);
      loaded();
      closed();
      error();
    };

    const loaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        console.log("[Ad] Interstitial loaded");
        interstitial.show().catch(() => {
          cleanup();
          resolve();
        });
      }
    );

    const closed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log("[Ad] Interstitial closed");
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve();
      }
    );

    const error = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (err) => {
        console.log("[Ad] Interstitial error:", err);
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(); // ✅ NEVER reject
      }
    );

    interstitial.load();
  });
}
