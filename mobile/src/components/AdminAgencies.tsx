import { useCallback, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApp } from "../lib/session";
import { cities, type Agency } from "../lib/types";
import { Button, Chips, ErrorMessage, Field, styles } from "./ui";

const empty = {
  id: 0,
  name: "",
  city: "Casablanca",
  address: "",
  phone: "",
  latitude: "33.5926",
  longitude: "-7.6341",
};
export default function AdminAgencies() {
  const { api, user } = useApp();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<Agency | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setAgencies(await api<Agency[]>("/api/locations"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !form.latitude.trim() ||
        !form.longitude.trim() ||
        !Number.isFinite(Number(form.latitude)) ||
        !Number.isFinite(Number(form.longitude))
      )
        throw new Error("Vérifiez les coordonnées GPS.");
      await api(`/api/admin/locations${form.id ? `/${form.id}` : ""}`, {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      setForm(empty);
      setEditing(false);
      setMessage("Bureau de location enregistré.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/locations/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      setMessage("Bureau retiré des agences disponibles. Historique conservé.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.role !== "Admin")
    return <Text style={styles.body}>Accès administrateur requis.</Text>;
  return (
    <>
      <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Bureaux de location</Text>
          <Text style={styles.body}>
            Ajoutez, modifiez ou supprimez les emplacements de vos bureaux.
          </Text>
          <Button
            title="Ajouter un bureau de location"
            disabled={busy}
            onPress={() => {
              setForm(empty);
              setEditing(true);
              setError("");
            }}
          />
          <Button
            title="Actualiser les agences"
            secondary
            disabled={busy}
            onPress={() => {
              setError("");
              void load();
            }}
          />
          <ErrorMessage message={error} />
          {Boolean(message) && (
            <Text accessibilityRole="alert" style={styles.body}>
              {message}
            </Text>
          )}
          {editing && (
            <View style={styles.card}>
              <Text style={styles.heading}>
                {form.id ? "Modifier le bureau" : "Nouveau bureau de location"}
              </Text>
              {(
                [
                  ["name", "Nom du bureau"],
                  ["address", "Adresse"],
                  ["phone", "Téléphone"],
                  ["latitude", "Latitude"],
                  ["longitude", "Longitude"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={form[key]}
                  maxLength={
                    key === "address" ? 300 : key === "name" ? 120 : 30
                  }
                  onChangeText={(value) => setForm({ ...form, [key]: value })}
                />
              ))}
              <Text style={styles.label}>Ville</Text>
              <Chips
                value={form.city}
                onChange={(city) => setForm({ ...form, city })}
                options={cities.map((value) => ({ value, label: value }))}
              />
              <Button
                title={
                  form.id
                    ? "Enregistrer les modifications"
                    : "Publier le bureau"
                }
                busy={busy}
                onPress={() => void save()}
              />
              <Button
                title="Annuler"
                secondary
                disabled={busy}
                onPress={() => setEditing(false)}
              />
            </View>
          )}
          {agencies.length === 0 && (
            <Text style={styles.body}>Aucun bureau publié.</Text>
          )}
          {agencies.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.heading}>{a.name}</Text>
              <Text style={styles.body}>
                {a.address} · {a.city}
                {"\n"}
                {a.phone}
              </Text>
              <Text style={styles.small}>
                GPS : {a.latitude}, {a.longitude}
              </Text>
              <Button
                title={`Modifier ${a.name}`}
                secondary
                disabled={busy}
                onPress={() => {
                  setForm({
                    ...a,
                    latitude: String(a.latitude),
                    longitude: String(a.longitude),
                  });
                  setEditing(true);
                  setError("");
                }}
              />
              <Button
                title={`Supprimer ${a.name}`}
                danger
                disabled={busy}
                onPress={() => {
                  setRemoving(a);
                  setError("");
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(removing)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setRemoving(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#102A22BB",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View style={styles.card}>
            <Text style={styles.heading}>Supprimer ce bureau ?</Text>
            <Text style={styles.body}>
              {removing?.name}
              {"\n"}L’emplacement sera retiré des agences disponibles.
              L’historique sera conservé. Un bureau lié à une demande ou
              location en cours ne peut pas être supprimé.
            </Text>
            <ErrorMessage message={error} />
            <Button
              title="Confirmer la suppression du bureau"
              danger
              busy={busy}
              onPress={() => void remove()}
            />
            <Button
              title="Garder ce bureau"
              secondary
              disabled={busy}
              onPress={() => setRemoving(null)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
