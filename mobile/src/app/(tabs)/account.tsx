import { useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../../lib/session";
import {
  Button,
  DemoNote,
  ErrorMessage,
  Field,
  Icon,
  styles,
} from "../../components/ui";
export default function Account() {
  const { user, signOut, baseUrl, changeServer, api } = useApp();
  const [server, setServer] = useState(baseUrl);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveServer() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await changeServer(server);
      setMessage("Préférence de connexion enregistrée.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const health = await api<{ service: string; database: string }>(
        "/api/health",
      );
      if (
        health.service !== "Location Ennour API" ||
        health.database !== "connected"
      )
        throw new Error(
          "Ce serveur ne correspond pas à une API Location Ennour disponible.",
        );
      setMessage("Connexion réussie à Location Ennour.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>Votre espace.</Text>
        <View style={styles.card}>
          <Icon name="person-circle-outline" size={40} />
          <Text style={styles.heading}>
            {user?.fullName || "Bienvenue chez Location Ennour"}
          </Text>
          <Text style={styles.body}>
            {user?.email ||
              "Connectez-vous pour réserver et suivre vos locations."}
          </Text>
          {user ? (
            <>
              <Text style={styles.small}>
                {user.role === "Admin" ? "Administrateur" : "Voyageur"}
              </Text>
              <Button
                secondary
                title={
                  user.role === "Admin"
                    ? "Demandes clients"
                    : "Mes réservations"
                }
                onPress={() => router.push("/bookings")}
              />
              {user.role === "Admin" && (
                <Button
                  title="Administration"
                  onPress={() => router.push("/admin")}
                />
              )}
              <Button
                secondary
                title="Me déconnecter"
                onPress={() => {
                  void signOut().catch((e) => setError(e.message));
                }}
              />
            </>
          ) : (
            <Button
              title="Connexion / Inscription"
              onPress={() => router.push("/auth")}
            />
          )}
        </View>
        {user?.role !== "Admin" && (
          <Button
            secondary
            title="Parler à l’assistant"
            onPress={() => router.push("/chat")}
          />
        )}
        <ErrorMessage message={error} />
        {message ? (
          <Text accessibilityRole="alert" style={styles.body}>
            {message}
          </Text>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.heading}>Connexion au serveur</Text>
          <Text style={styles.small}>
            Expo Go utilise automatiquement le serveur qui a ouvert
            l’application. Effacez le champ et enregistrez pour revenir à
            l’adresse automatique.
          </Text>
          <Field
            label="Adresse du serveur"
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://api.exemple.com"
          />
          <Button
            title="Enregistrer le serveur"
            secondary
            busy={busy}
            onPress={saveServer}
          />
          <Button title="Tester la connexion" busy={busy} onPress={test} />
          <Text style={styles.small}>
            Serveur actif · {baseUrl || "à configurer"}
          </Text>
        </View>
        <Button
          title="Photos réelles illustratives · Crédits"
          secondary
          onPress={() => {
            Linking.openURL(`${baseUrl}/api/photo-credits`).catch(() =>
              setError("Impossible d’ouvrir les crédits photos."),
            );
          }}
        />
        <DemoNote />
      </View>
    </ScrollView>
  );
}
