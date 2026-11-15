import { Tabs } from "expo-router";
import { colors, Icon } from "../../components/ui";
import { useApp } from "../../lib/session";
const screens = [
  { name: "index", title: "Accueil", icon: "home-outline" },
  { name: "fleet", title: "Voitures", icon: "car-sport-outline" },
  { name: "bookings", title: "Locations", icon: "calendar-outline" },
  { name: "agencies", title: "Agences", icon: "location-outline" },
  { name: "account", title: "Mon compte", icon: "person-outline" },
] as const;
export default function TabsLayout() {
  const { user } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      {screens.map((screen) => (
        <Tabs.Screen
          key={screen.name}
          name={screen.name}
          options={{
            title: screen.title,
            headerTitle:
              user?.role === "Admin"
                ? (
                    {
                      fleet: "Gestion des voitures",
                      bookings: "Demandes clients",
                      agencies: "Bureaux de location",
                    } as Record<string, string>
                  )[screen.name] || screen.title
                : screen.title,
            tabBarIcon: ({ color }) => (
              <Icon name={screen.icon} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
