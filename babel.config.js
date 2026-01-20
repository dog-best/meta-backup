module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      // Required for Expo Router (typed routes, layouts, etc.)
      "expo-router/babel",
      // Keep this LAST per Reanimated docs
      "react-native-reanimated/plugin",
    ],
  };
};
