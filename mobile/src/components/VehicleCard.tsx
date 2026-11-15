import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Vehicle } from "../lib/types";
import { money } from "../lib/types";
import { colors, Icon, styles } from "./ui";
import { useApp } from "../lib/session";
export function VehicleCard({
  vehicle,
  startDate,
  endDate,
}: {
  vehicle: Vehicle;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${vehicle.brand} ${vehicle.model}, ${money(vehicle.dailyRate)} par jour`}
      onPress={() =>
        user?.role === "Admin"
          ? router.push({
              pathname: "/admin-vehicle",
              params: { id: String(vehicle.id) },
            })
          : router.push({
              pathname: "/vehicle/[id]",
              params: { id: String(vehicle.id), startDate, endDate },
            })
      }
      style={[styles.card, { padding: 0, overflow: "hidden" }]}
    >
      <Image
        source={{ uri: vehicle.imageUrl }}
        accessibilityLabel={`${vehicle.brand} ${vehicle.model}, photo illustrative`}
        style={{ height: 190, width: "100%", backgroundColor: colors.border }}
        resizeMode="cover"
      />
      <View style={{ padding: 18, gap: 12 }}>
        <View style={styles.between}>
          <Text style={styles.label}>{vehicle.brand}</Text>
          <Text style={styles.small}>
            {vehicle.category} · {vehicle.year}
          </Text>
        </View>
        <Text style={styles.heading}>{vehicle.model}</Text>
        <View style={styles.row}>
          <Icon name="people-outline" size={16} />
          <Text style={styles.small}>
            {vehicle.seats} places · {vehicle.transmission} · {vehicle.fuel}
          </Text>
        </View>
        <View style={styles.between}>
          <Text style={styles.body}>{vehicle.city}</Text>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 19 }}>
            {money(vehicle.dailyRate)}
            <Text style={styles.small}> / j</Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
