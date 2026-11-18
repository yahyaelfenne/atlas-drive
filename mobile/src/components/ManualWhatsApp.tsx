import { useEffect, useState } from "react";
import { Linking, Modal, Platform, ScrollView, Text, View } from "react-native";
import { useApp } from "../lib/session";
import { type Booking } from "../lib/types";
import { shareContract } from "../lib/contract";
import { Button, ErrorMessage, Loading, styles } from "./ui";

type Prepared = { phone: string; message: string; whatsappUrl: string };
export function ManualWhatsApp({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { api } = useApp();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<Prepared>(`/api/admin/bookings/${booking.id}/whatsapp/manual`, { method: "POST" })
      .then(value => { if (active) setPrepared(value); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [api, booking.id]);
  async function contract() {
    if (busy) return;
    const viewer = Platform.OS === "web" ? window.open("", "_blank") : null;
    setBusy(true); setError("");
    try {
      const html = await api<string>(`/api/bookings/${booking.id}/contract`, {}, true);
      if (Platform.OS === "web" && viewer) {
        viewer.document.open(); viewer.document.write(html); viewer.document.close();
      } else await shareContract(html);
    } catch (e) { viewer?.close(); setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openWhatsApp() {
    if (!prepared) return;
    try { await Linking.openURL(prepared.whatsappUrl); }
    catch { setError("Impossible d’ouvrir WhatsApp. Vérifiez que l’application ou WhatsApp Web est disponible."); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Envoyer le contrat sur WhatsApp</Text>
      <Text style={styles.label}>{booking.reference} · ENVOI MANUEL</Text>
      <ErrorMessage message={error} />
      {!prepared && !error && <Loading />}
      {prepared && <>
        <Text style={styles.body}>Client : {booking.userName}{"\n"}WhatsApp : {prepared.phone}</Text>
        <Text style={styles.body}>{Platform.OS === "web" ? "1. Ouvrez le contrat, puis utilisez Imprimer / Enregistrer en PDF. Si le navigateur bloque la fenêtre, ouvrez le fichier HTML téléchargé et enregistrez-le en PDF." : "1. Ouvrez WhatsApp avec le message prérempli. Revenez ensuite ici pour partager le PDF avec le même client."}</Text>
        {Platform.OS === "web" && <Button title="1. Ouvrir le contrat / PDF" onPress={() => void contract()} busy={busy} />}
        <Button title={Platform.OS === "web" ? "2. Ouvrir WhatsApp avec le message" : "1. Ouvrir WhatsApp avec le message"} onPress={() => void openWhatsApp()} disabled={busy} />
        {Platform.OS !== "web" && <Button title="2. Générer et partager le contrat PDF" onPress={() => void contract()} busy={busy} />}
        <Text style={styles.small}>{Platform.OS === "web" ? "Joignez le PDF enregistré à la conversation du client." : "Dans le menu de partage, choisissez WhatsApp Business puis le client correspondant au numéro ci-dessus."} Vérifiez le destinataire et confirmez l’envoi dans WhatsApp.</Text>
        <View style={styles.card}><Text selectable style={styles.body}>{prepared.message}</Text></View>
        <Text style={styles.small}>Le statut reste « message préparé ». L’application ne peut pas confirmer l’envoi ou la réception dans WhatsApp.</Text>
      </>}
      <Button title="Fermer" secondary onPress={onClose} disabled={busy} />
    </ScrollView>
  </Modal>;
}
