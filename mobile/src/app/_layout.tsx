import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "../lib/session";
import { colors, Loading } from "../components/ui";
function Navigation() {
  const { ready } = useApp();
  if (!ready) return <Loading />;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vehicle/[id]"
          options={{ title: "Votre prochaine escapade" }}
        />
        <Stack.Screen
          name="auth"
          options={{ title: "Mon espace", presentation: "modal" }}
        />
        <Stack.Screen
          name="chat"
          options={{ title: "Votre copilote Location Ennour" }}
        />
        <Stack.Screen
          name="recommend"
          options={{ title: "Trouvons votre voiture" }}
        />
        <Stack.Screen name="admin" options={{ title: "Administration" }} />
        <Stack.Screen
          name="management"
          options={{ title: "Demandes et agences" }}
        />
        <Stack.Screen
          name="admin-vehicle"
          options={{ title: "Gestion du véhicule" }}
        />
      </Stack>
    </>
  );
}
export default function Layout() {
  return (
    <AppProvider>
      <Navigation />
    </AppProvider>
  );
}
