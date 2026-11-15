import AdminPanel from "../../components/AdminPanel";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useApp } from "../../lib/session";
import { categories, cities, day, type Vehicle } from "../../lib/types";
import {
  Button,
  Chips,
  colors,
  DemoNote,
  ErrorMessage,
  Field,
  Loading,
  styles,
} from "../../components/ui";
import { DateField } from "../../components/DateField";
import { VehicleCard } from "../../components/VehicleCard";
export default function Fleet() {
  const { user } = useApp();
  return user?.role === "Admin" ? (
    <AdminPanel fixedTab="fleet" />
  ) : (
    <CustomerFleet />
  );
}
function CustomerFleet() {
  const { api } = useApp();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [transmission, setTransmission] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [start, setStart] = useState(day(1));
  const [end, setEnd] = useState(day(4));
  const [filters, setFilters] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ startDate: start, endDate: end });
      if (search.trim()) params.set("search", search.trim());
      if (city) params.set("city", city);
      if (category) params.set("category", category);
      if (transmission) params.set("transmission", transmission);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const result = await api<Vehicle[]>(`/api/vehicles?${params}`);
      if (current === requestId.current) setVehicles(result);
    } catch (e) {
      if (current === requestId.current) setError((e as Error).message);
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }, [api, search, city, category, transmission, maxPrice, start, end]);
  // Typing does not send a request for every character.
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 350);
    return () => clearTimeout(timer);
  }, [load, refresh]);
  useFocusEffect(
    useCallback(() => {
      setRefresh((value) => value + 1);
    }, []),
  );
  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={error || busy ? [] : vehicles}
      keyExtractor={(item) => String(item.id)}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      renderItem={({ item }) => (
        <VehicleCard vehicle={item} startDate={start} endDate={end} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={load}
          tintColor={colors.ink}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 18 }}>
          <Text style={styles.title}>Votre prochaine{"\n"}escapade.</Text>
          <Field
            label="Rechercher"
            placeholder="Marque, modèle, équipement…"
            value={search}
            onChangeText={setSearch}
          />
          <Chips
            options={[
              { label: "Toutes les villes", value: "" },
              ...cities.map((value) => ({ label: value, value })),
            ]}
            value={city}
            onChange={setCity}
          />
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <DateField
                label="Départ"
                value={start}
                onChange={setStart}
                minimum={day()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateField
                label="Retour"
                value={end}
                onChange={setEnd}
                minimum={start}
              />
            </View>
          </View>
          <Chips
            options={[
              { label: "Tous", value: "" },
              ...categories.map((value) => ({ label: value, value })),
            ]}
            value={category}
            onChange={setCategory}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                title={filters ? "Masquer les filtres" : "Plus de filtres"}
                onPress={() => setFilters(!filters)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                title="Conseiller AI"
                onPress={() => router.push("/recommend")}
              />
            </View>
          </View>
          {filters && (
            <View style={styles.card}>
              <Chips
                options={[
                  { label: "Toutes", value: "" },
                  { label: "Automatique", value: "Automatique" },
                  { label: "Manuelle", value: "Manuelle" },
                ]}
                value={transmission}
                onChange={setTransmission}
              />
              <Field
                label="Budget maximum par jour (MAD)"
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="Sans limite"
              />
            </View>
          )}
          <ErrorMessage message={error} retry={load} />
          <Text style={styles.small}>
            {busy
              ? "Recherche de votre prochaine aventure…"
              : `${vehicles.length} véhicule(s) disponible(s)`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        busy ? (
          <Loading />
        ) : !error ? (
          <View style={styles.card}>
            <Text style={styles.heading}>
              Aucun véhicule pour ces critères.
            </Text>
            <Text style={styles.body}>
              Essayez une autre période ou élargissez vos filtres.
            </Text>
          </View>
        ) : undefined
      }
      ListFooterComponent={<DemoNote />}
    />
  );
}
