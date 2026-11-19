import { contractEmailLabel } from "../../lib/types";
import AdminPanel from "../../components/AdminPanel";
import { useCallback, useState } from "react";
import {
  Platform,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useApp } from "../../lib/session";
import { dateLabel, money, statusLabel, type Booking } from "../../lib/types";
import { shareContract } from "../../lib/contract";
import {
  Button,
  Chips,
  colors,
  DemoNote,
  ErrorMessage,
  Loading,
  styles,
} from "../../components/ui";
export default function Bookings() {
  const { user } = useApp();
  return user?.role === "Admin" ? (
    <AdminPanel fixedTab="bookings" />
  ) : (
    <CustomerBookings />
  );
}
function CustomerBookings() {
  const { api, user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [cancel, setCancel] = useState<Booking | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      setBookings(await api<Booking[]>("/api/bookings"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, user]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function contract(booking: Booking) {
    setActionId(booking.id);
    setError("");
    try {
      await shareContract(
        await api<string>(`/api/bookings/${booking.id}/contract`, {}, true),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }
  async function confirmCancel() {
    if (!cancel) return;
    setActionId(cancel.id);
    setError("");
    try {
      await api(`/api/bookings/${cancel.id}/cancel`, { method: "POST" });
      setCancel(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setCancel(null);
    } finally {
      setActionId(null);
    }
  }
  if (!user)
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Vos voyages,{"\n"}au même endroit.</Text>
        <Text style={styles.body}>
          Connectez-vous pour retrouver vos réservations et vos contrats.
        </Text>
        <Button title="Me connecter" onPress={() => router.push("/auth")} />
      </View>
    );
  const visible = bookings.filter((item) => !filter || item.status === filter);
  return (
    <>
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
          <Text style={styles.title}>
            Bonjour, {user.fullName.split(" ")[0]}.
          </Text>
          <Text style={styles.body}>
            Vos prochains départs et vos beaux souvenirs, juste ici.
          </Text>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { label: "Toutes", value: "" },
              ...[
                "Pending",
                "Rejected",
                "Confirmed",
                "Active",
                "Completed",
                "Cancelled",
              ].map((value) => ({
                label: statusLabel[value as keyof typeof statusLabel],
                value,
              })),
            ]}
          />
          <ErrorMessage message={error} retry={load} />
          {busy && !bookings.length && <Loading />}
          {!busy && !visible.length && (
            <View style={styles.card}>
              <Text style={styles.heading}>La route vous attend.</Text>
              <Text style={styles.body}>
                Aucune réservation dans cette sélection.
              </Text>
              <Button
                secondary
                title="Choisir une voiture"
                onPress={() => router.push("/fleet")}
              />
            </View>
          )}
          {visible.map((booking) => (
            <View key={booking.id} style={styles.card}>
              <View style={styles.between}>
                <Text style={[styles.label, { fontSize: 10 }]}>
                  {booking.reference}
                </Text>
                <Text style={{ fontWeight: "700", color: colors.ink }}>
                  {statusLabel[booking.status]}
                </Text>
              </View>
              <Image
                source={{ uri: booking.vehicleImageUrl }}
                style={{ height: 150, borderRadius: 14 }}
              />
              <Text style={styles.heading}>{booking.vehicleName}</Text>
              <Text style={styles.body}>
                {dateLabel(booking.startDate)} → {dateLabel(booking.endDate)}
                {"\n"}
                {booking.days} jour(s) · {booking.pickupLocationName}
              </Text>
              <Text style={styles.small}>
                Retour · {booking.returnLocationName}
              </Text>
              <Text style={styles.heading}>
                {money(booking.total + booking.damageFee)}
              </Text>
              <Text style={styles.small}>
                Caution séparée · {money(booking.deposit)}
              </Text>
              {Boolean(booking.returnNotes) && (
                <Text style={styles.small}>
                  Inspection · {booking.returnNotes}
                </Text>
              )}
              {booking.status === "Pending" && (
                <Text style={styles.body}>
                  Votre demande attend la validation admin.
                </Text>
              )}
              {Boolean(booking.contactEmail || booking.contactWhatsApp) && <Text style={styles.small}>Contrat ({booking.contractDeliveryChannel}) : {booking.contactWhatsApp || booking.contactEmail}{"\n"}{contractEmailLabel(booking.contractEmailStatus)}</Text>}
              {Boolean(booking.reviewNote) && (
                <Text style={styles.body}>
                  Message de l’agence : {booking.reviewNote}
                </Text>
              )}
              {booking.paymentStatus === "TestPaid" && (
                <Text style={styles.body}>
                  Paiement test réussi · aucun débit réel
                </Text>
              )}
              {booking.paymentStatus === "TestRefunded" && (
                <Text style={styles.body}>
                  Remboursement simulé · aucun débit réel
                </Text>
              )}
              <Button
                secondary
                title={
                  Platform.OS === "web"
                    ? "Télécharger le contrat"
                    : "Partager le contrat PDF"
                }
                busy={actionId === booking.id}
                disabled={
                  actionId !== null ||
                  ["Pending", "Rejected", "Cancelled"].includes(booking.status)
                }
                onPress={() => {
                  void contract(booking);
                }}
              />
              {["Pending", "Confirmed"].includes(booking.status) && (
                <Button
                  title="Annuler la réservation"
                  danger
                  disabled={actionId !== null}
                  onPress={() => setCancel(booking)}
                />
              )}
            </View>
          ))}
          <DemoNote />
        </View>
      </ScrollView>

      <Modal
        visible={cancel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (actionId === null) setCancel(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#102A22AA",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View style={styles.card}>
            <Text style={styles.heading}>Annuler ce départ ?</Text>
            <Text style={styles.body}>
              La réservation {cancel?.reference} sera annulée et la voiture
              redeviendra disponible.
            </Text>
            <Button
              secondary
              title="Garder ma réservation"
              disabled={actionId !== null}
              onPress={() => setCancel(null)}
            />
            <Button
              title="Confirmer l’annulation"
              danger
              busy={actionId !== null}
              onPress={() => {
                void confirmCancel();
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
