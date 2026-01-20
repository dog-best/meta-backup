const { withAndroidManifest } = require("@expo/config-plugins");

function setAdmobApplicationId(androidManifest, appId) {
  const app = androidManifest.manifest.application?.[0];
  if (!app) {
    throw new Error("AndroidManifest: <application> tag not found.");
  }

  // Ensure tools namespace exists
  androidManifest.manifest.$["xmlns:tools"] =
    androidManifest.manifest.$["xmlns:tools"] ||
    "http://schemas.android.com/tools";

  if (!app["meta-data"]) {
    app["meta-data"] = [];
  }

  // Remove previous conflicting meta-data
  app["meta-data"] = app["meta-data"].filter(
    (item) =>
      item.$["android:name"] !== "com.google.android.gms.ads.APPLICATION_ID"
  );

  // Add our new meta-data
  app["meta-data"].push({
    $: {
      "android:name": "com.google.android.gms.ads.APPLICATION_ID",
      "android:value": appId,
      "tools:replace": "android:value"
    }
  });

  return androidManifest;
}

module.exports = function withAdmobAppId(config) {
  return withAndroidManifest(config, (config) => {
    const appId = config.extra?.reactNativeGoogleMobileAdsAppId;

    console.log("🔹 Detected AdMob App ID:", appId);

    if (!appId) {
      if (process.env.EXPO_BUILD_PLATFORM === "android") {
        throw new Error(
          "❌ Missing AdMob App ID — Add extra.reactNativeGoogleMobileAdsAppId in app.json"
        );
      } else {
        console.warn(
          "⚠️ [withAdmobAppId] Missing AdMob App ID during non-Android build. Skipping..."
        );
        return config;
      }
    }

    config.modResults = setAdmobApplicationId(config.modResults, appId);
    return config;
  });
};
