import { useCallback, useState } from "react";
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useApp } from "../../lib/session";
import type { Vehicle } from "../../lib/types";
import {
  Button,
  colors,
  DemoNote,
  ErrorMessage,
  Icon,
  styles,
} from "../../components/ui";
import { VehicleCard } from "../../components/VehicleCard";
export default function Home() {
  const { user } = useApp();
  if (user?.role === "Admin")
    return (
      <ScrollView style={styles.page}>
        <View style={styles.content}>
          <Text style={styles.label}>LOCATION ENNOUR · ADMINISTRATION</Text>
          <Text style={styles.title}>
            Bonjour, {user.fullName.split(" ")[0]}.
          </Text>
          <Text style={styles.body}>
            Gérez votre agence depuis les trois onglets. Les réservations sont
            effectuées uniquement par les comptes clients.
          </Text>
          <Button
            title="Locations · demandes clients"
            onPress={() => router.push("/bookings")}
          />
          <Button
            title="Voitures · ajouter ou supprimer"
            onPress={() => router.push("/fleet")}
          />
          <Button
            title="Agences · gérer les bureaux"
            onPress={() => router.push("/agencies")}
          />
          <Button
            title="Tableau de bord"
            secondary
            onPress={() => router.push("/admin")}
          />
        </View>
      </ScrollView>
    );
  return <CustomerHome />;
}
function CustomerHome() {
  const { api, user } = useApp();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setVehicles(await api<Vehicle[]>("/api/vehicles"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <ScrollView
      style={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={load}
          tintColor={colors.ink}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.between}>
          <Text style={[styles.heading, { fontSize: 22, flexShrink: 1 }]}>
            E Location Ennour<Text style={{ color: "#8AA45D" }}>.</Text>
          </Text>
          <Text style={styles.small}>
            {user
              ? `Bonjour ${user.fullName.split(" ")[0]}`
              : "Le Maroc vous attend"}
          </Text>
        </View>
        <ImageBackground
          source={require("../../../assets/hero-porsche.jpg")}
          style={{
            height: 350,
            borderRadius: 26,
            overflow: "hidden",
            justifyContent: "flex-end",
          }}
        >
          <View style={{ padding: 25, gap: 13, backgroundColor: "#102A2299" }}>
            <Text
              style={{
                color: colors.lime,
                fontWeight: "700",
                letterSpacing: 2,
                fontSize: 11,
              }}
            >
              LA LIBERTÉ PREND LA ROUTE
            </Text>
            <Text
              style={{
                fontSize: 41,
                lineHeight: 46,
                color: colors.white,
                fontWeight: "700",
                letterSpacing: -1.7,
              }}
            >
              Le Maroc,{"\n"}à votre rythme.
            </Text>
            <Text style={{ color: "#F0F4E9", fontSize: 15 }}>
              La bonne voiture pour vos beaux détours.
            </Text>
            <Button
              title="Trouver ma voiture →"
              secondary
              onPress={() => router.push("/fleet")}
            />
          </View>
        </ImageBackground>
        <View style={[styles.card, styles.row]}>
          <Icon name="shield-checkmark-outline" />
          <Text style={[styles.body, { flex: 1 }]}>
            Assurance de base incluse. Tarifs en MAD et paiement à l’agence.
          </Text>
        </View>
        <View style={styles.between}>
          <Text style={styles.heading}>À chaque voyage,{"\n"}sa voiture.</Text>
          <Button
            title="Tout voir"
            secondary
            onPress={() => router.push("/fleet")}
          />
        </View>
        <ErrorMessage message={error} retry={load} />
        {vehicles
          .filter((v) => v.status === "Available")
          .slice(0, 3)
          .map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        <View style={[styles.card, { backgroundColor: colors.lime }]}>
          <Icon name="sparkles-outline" />
          <Text style={styles.heading}>Un coup de main pour choisir ?</Text>
          <Text style={styles.body}>
            Votre budget, vos voyageurs. On vous aide à trouver votre compagnon
            de route.
          </Text>
          <Button
            title="M’aider à choisir"
            onPress={() => router.push("/recommend")}
          />
        </View>
        <Button
          secondary
          title="Une question ? Parlons-en"
          onPress={() => router.push("/chat")}
        />
        <DemoNote />
      </View>
    </ScrollView>
  );
}
