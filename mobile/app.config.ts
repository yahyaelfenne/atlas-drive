const isRelease = process.env.APP_VARIANT === "production";
if (isRelease && !process.env.EXPO_PUBLIC_API_URL?.startsWith("https://")) {
  throw new Error(
    "Set EXPO_PUBLIC_API_URL to your HTTPS backend URL before building an installable app.",
  );
}
export default {
  expo: {
    name: "Location Ennour",
    slug: "location-ennour-mobile",
    scheme: "locationennour",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "ma.atlasdrive.mobile",
      infoPlist: {
        NSLocalNetworkUsageDescription:
          "Location Ennour se connecte au serveur de votre PC pour tester les locations sur le réseau local.",
        NSAppTransportSecurity: { NSAllowsLocalNetworking: !isRelease },
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "ma.atlasdrive.mobile",
      predictiveBackGestureEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#173E31",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      "expo-sharing",
      "expo-status-bar",
      "@react-native-community/datetimepicker",
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: !isRelease } },
      ],
    ],
    web: { bundler: "metro", output: "single", favicon: "./assets/icon.png" },
    experiments: { typedRoutes: true },
  },
};
