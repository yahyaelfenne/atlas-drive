import AdminAgencies from "../../components/AdminAgencies";
import { useCallback, useState } from "react";
import { Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApp } from "../../lib/session";
import type { Agency } from "../../lib/types";
import {
  Button,
  colors,
  DemoNote,
  ErrorMessage,
  Icon,
  Loading,
  styles,
} from "../../components/ui";
export default function Agencies() {
  const { user } = useApp();
  return user?.role === "Admin" ? <AdminAgencies /> : <PublicAgencies />;
}
function PublicAgencies() {
  const { api } = useApp();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setAgencies(await api<Agency[]>("/api/locations"));
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
  async function openMap(agency: Agency) {
    try {
      await Linking.openURL(
        `https://www.openstreetmap.org/?mlat=${agency.latitude}&mlon=${agency.longitude}#map=15/${agency.latitude}/${agency.longitude}`,
      );
    } catch {
      setError("Impossible d’ouvrir la carte sur cet appareil.");
    }
  }
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
        <Text style={styles.label}>UN BON POINT DE DÉPART</Text>
        <Text style={styles.title}>Retrouvons-nous{"\n"}en agence.</Text>
        <Text style={styles.body}>
          Quatre villes, une même envie de vous faire prendre la route.
        </Text>
        <ErrorMessage message={error} retry={load} />
        {busy && !agencies.length && <Loading />}
        {agencies.map((agency) => (
          <View key={agency.id} style={styles.card}>
            <Icon name="location-outline" />
            <Text style={styles.label}>{agency.city}</Text>
            <Text style={styles.heading}>{agency.name}</Text>
            <Text style={styles.body}>{agency.address}</Text>
            <Text style={styles.small}>{agency.phone}</Text>
            <Button
              title="Ouvrir la carte"
              secondary
              onPress={() => {
                void openMap(agency);
              }}
            />
          </View>
        ))}
        <DemoNote />
      </View>
    </ScrollView>
  );
}
