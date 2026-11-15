import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/session";
import { categories, cities, type Vehicle } from "../lib/types";
import {
  Button,
  Chips,
  ErrorMessage,
  Field,
  Loading,
  styles,
} from "../components/ui";
const initial = {
  brand: "",
  model: "",
  year: String(new Date().getFullYear()),
  dailyRate: "",
  deposit: "4000",
  seats: "5",
  category: "Citadine",
  transmission: "Automatique",
  fuel: "Essence",
  city: "Casablanca",
  status: "Available",
  description: "",
  imageUrl: "",
  features: "Climatisation, Bluetooth, USB",
};
export default function VehicleEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { api, user } = useApp();
  const [form, setForm] = useState(initial);
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const set = (key: keyof typeof initial, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!id || user?.role !== "Admin") return;
    let active = true;
    api<Vehicle>(`/api/vehicles/${id}`)
      .then((vehicle) => {
        if (!active) return;
        setForm({
          ...vehicle,
          year: String(vehicle.year),
          dailyRate: String(vehicle.dailyRate),
          deposit: String(vehicle.deposit),
          seats: String(vehicle.seats),
          features: vehicle.features.join(", "),
        });
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, id, user?.role]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (
        ![form.year, form.dailyRate, form.deposit, form.seats].every(
          (value) => value.trim() && Number.isFinite(Number(value)),
        )
      )
        throw new Error("Les valeurs numériques sont obligatoires.");
      await api(`/api/admin/vehicles${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          dailyRate: Number(form.dailyRate),
          deposit: Number(form.deposit),
          seats: Number(form.seats),
          features: form.features
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/vehicles/${id}`, { method: "DELETE" });
      setArchiveOpen(false);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setArchiveOpen(false);
    } finally {
      setBusy(false);
    }
  }
  if (user?.role !== "Admin")
    return (
      <View style={styles.content}>
        <Text style={styles.body}>Un compte administrateur est requis.</Text>
      </View>
    );
  if (!ready)
    return error ? (
      <View style={styles.content}>
        <ErrorMessage message={error} />
      </View>
    ) : (
      <Loading />
    );
  return (
    <>
      <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>
            {id ? "Votre flotte évolue." : "Un nouveau départ."}
          </Text>
          {(
            [
              { key: "brand", label: "Marque" },
              { key: "model", label: "Modèle" },
              { key: "year", label: "Année", numeric: true },
              {
                key: "dailyRate",
                label: "Tarif par jour (MAD)",
                numeric: true,
              },
              { key: "deposit", label: "Caution (MAD)", numeric: true },
              { key: "seats", label: "Places", numeric: true },
              { key: "imageUrl", label: "URL HTTPS de la photo" },
              { key: "description", label: "Description" },
              { key: "features", label: "Équipements séparés par une virgule" },
            ] as const
          ).map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={form[field.key]}
              onChangeText={(value) => set(field.key, value)}
              keyboardType={"numeric" in field ? "numeric" : "default"}
              multiline={field.key === "description"}
              autoCapitalize={field.key === "imageUrl" ? "none" : "sentences"}
            />
          ))}
          {(
            [
              { key: "category", label: "Catégorie", values: categories },
              {
                key: "transmission",
                label: "Transmission",
                values: ["Automatique", "Manuelle"],
              },
              {
                key: "fuel",
                label: "Carburant",
                values: ["Essence", "Diesel", "Hybride", "Électrique"],
              },
              { key: "city", label: "Ville", values: cities },
            ] as const
          ).map((field) => (
            <View key={field.key} style={{ gap: 8 }}>
              <Text style={styles.label}>{field.label}</Text>
              <Chips
                value={form[field.key]}
                onChange={(value) => set(field.key, value)}
                options={field.values.map((value) => ({ label: value, value }))}
              />
            </View>
          ))}
          <Chips
            value={form.status}
            onChange={(value) => set("status", value)}
            options={[
              { label: "Disponible", value: "Available" },
              { label: "Maintenance", value: "Maintenance" },
            ]}
          />
          <ErrorMessage message={error} />
          <Button title="Enregistrer le véhicule" busy={busy} onPress={save} />
          {Boolean(id) && (
            <Button
              title="Retirer du catalogue"
              danger
              disabled={busy}
              onPress={() => setArchiveOpen(true)}
            />
          )}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={archiveOpen}
        onRequestClose={() => {
          if (!busy) setArchiveOpen(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#102A22DD",
            padding: 24,
            justifyContent: "center",
          }}
        >
          <View style={styles.card}>
            <Text style={styles.heading}>Retirer ce véhicule ?</Text>
            <Text style={styles.body}>
              Il sera archivé. Les contrats et réservations passées restent
              consultables.
            </Text>
            <Button
              danger
              title="Confirmer le retrait"
              busy={busy}
              onPress={archive}
            />
            <Button
              secondary
              title="Garder le véhicule"
              disabled={busy}
              onPress={() => setArchiveOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
