import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/session";
import type { Session } from "../lib/types";
import {
  Button,
  DemoNote,
  ErrorMessage,
  Field,
  styles,
} from "../components/ui";
export default function Auth() {
  const { api, signIn } = useApp();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Session>(
        `/api/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            phone,
          }),
        },
      );
      await signIn(result);
      if (router.canGoBack()) router.back();
      else router.replace("/account");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.label}>VOTRE ESPACE VOYAGEUR</Text>
        <Text style={styles.title}>
          {register
            ? "Votre prochain voyage commence ici."
            : "Heureux de vous retrouver."}
        </Text>
        <Text style={styles.body}>
          {register
            ? "Créez un compte pour réserver et suivre vos locations."
            : "Connectez-vous pour retrouver vos réservations et vos contrats."}
        </Text>
        {register && (
          <>
            <Field
              label="Nom complet"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              maxLength={100}
            />
            <Field
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={30}
            />
          </>
        )}
        <Field
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={254}
          placeholder="vous@exemple.com"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={register ? "new-password" : "current-password"}
          maxLength={128}
          onSubmitEditing={submit}
        />
        {register && (
          <Text style={styles.small}>
            10 caractères minimum, avec majuscule, minuscule, chiffre et
            symbole.
          </Text>
        )}
        <ErrorMessage message={error} />
        <Button
          title={register ? "Créer mon compte" : "Me connecter"}
          busy={busy}
          disabled={
            !email.trim() ||
            !password ||
            (register && (!fullName.trim() || password.length < 10))
          }
          onPress={submit}
        />
        <Button
          secondary
          title={register ? "J’ai déjà un compte" : "Créer un compte"}
          onPress={() => {
            setRegister(!register);
            setError("");
          }}
        />
        <View style={{ paddingTop: 18 }}>
          <Button
            secondary
            title="Configurer le serveur"
            onPress={() => router.replace("/account")}
          />
        </View>
        <DemoNote />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
