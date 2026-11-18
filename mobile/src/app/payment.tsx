import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/session";
import { getCheckout, setCheckout } from "../lib/checkout";
import { money, type Booking } from "../lib/types";
import { Button, ErrorMessage, styles } from "../components/ui";
import { TestCardFields, cardError, emptyCard } from "../components/TestCardFields";
export default function Payment() {
  const { api, user } = useApp();
  const [draft] = useState(getCheckout);
  const [card, setCard] = useState(emptyCard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Booking | null>(null);
  const lock = useRef(false);
  const allowed = draft && user && user.role !== "Admin" && String(user.id) === draft.userId;
  async function pay() {
    if (!allowed || !draft || lock.current) return;
    const invalid = cardError(card); if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError("");
    try { const booking = await api<Booking>("/api/bookings", { method: "POST", body: JSON.stringify({ ...draft.input, payment: card }) });
      setCard(emptyCard); setCheckout(null); setSuccess(booking);
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (success) return <View style={styles.content}>
    <Text style={styles.title}>Votre demande est envoyée.</Text>
    <Text style={styles.body}>Paiement test accepté. Demande {success.reference} en attente de validation par l’admin. Aucun débit réel.</Text>
    <Button title="Suivre ma demande" onPress={() => router.replace("/bookings")} />
  </View>;
  if (!allowed || !draft) return <View style={styles.content}>
    <Text style={styles.body}>Sélectionnez une voiture et vos dates pour continuer.</Text>
    <Button title="Retour au catalogue" onPress={() => router.replace("/fleet")} />
  </View>;
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled"><View style={styles.content}>
      <Text style={styles.label}>ÉTAPE 2 SUR 2</Text><Text style={styles.title}>Paiement par carte</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>{draft.vehicleName}</Text>
        <Text style={styles.body}>Du {draft.input.startDate} au {draft.input.endDate} · {draft.quote.days} jour(s)</Text>
        <Text style={styles.body}>Départ : {draft.pickupName} · Retour : {draft.returnName}</Text>
        <Text style={styles.body}>Protection {draft.input.insurance === "premium" ? "Premium" : "de base"}{draft.input.childSeat ? " · Siège enfant" : ""}{draft.input.additionalDriver ? " · Conducteur additionnel" : ""}</Text>
        <Text style={styles.heading}>Total à payer : {money(draft.quote.total)}</Text>
        <Text style={styles.body}>Contrat par {draft.input.contractDeliveryChannel === "whatsapp" ? "WhatsApp" : "e-mail"} : {draft.input.contractDeliveryChannel === "whatsapp" ? draft.input.contactWhatsApp : draft.input.contactEmail}</Text>
        <Text style={styles.small}>Caution en agence : {money(draft.quote.deposit)}.</Text>
      </View>
      <TestCardFields value={card} onChange={setCard} disabled={busy} />
      <ErrorMessage message={error} />
      <Button title="Payer en test et envoyer la demande" busy={busy} disabled={busy} onPress={pay} />
      <Button title="Modifier ma location" secondary disabled={busy} onPress={() => router.back()} />
      <Text style={styles.small}>Paiement simulé, aucun débit réel. La demande sera ensuite validée par l’admin. En cas de refus, remboursement simulé.</Text>
    </View></ScrollView>
  </KeyboardAvoidingView>;
}
