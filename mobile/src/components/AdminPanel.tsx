import { ManualWhatsApp } from "./ManualWhatsApp";
import { Profitability } from "./Profitability";
import { contractEmailLabel } from "../lib/types";
import { useCallback, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useApp } from "../lib/session";
import {
  dateLabel,
  money,
  statusLabel,
  type Booking,
  type Dashboard,
  type Vehicle,
} from "../lib/types";
import {
  Button,
  Chips,
  colors,
  ErrorMessage,
  Field,
  Loading,
  styles,
} from "../components/ui";
interface Notice {
  id: number;
  title: string;
  message: string;
  createdAt: string;
}
const operationLabels = {
  overdue: { title: "Retours en retard", status: "Active" },
  returns: { title: "Retours aujourd’hui", status: "Active" },
  pickups: { title: "Départs à traiter", status: "Confirmed" },
  missed: { title: "Départs non effectués", status: "Confirmed" },
  pending: { title: "Demandes à valider", status: "Pending" },
};
export default function AdminPanel({
  fixedTab,
}: { fixedTab?: "bookings" | "fleet" } = {}) {
  const { user, api } = useApp();
  const [manualWhatsApp, setManualWhatsApp] = useState<Booking | null>(null);
  const [tab, setTab] = useState<string>(fixedTab || "dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Pending");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [action, setAction] = useState<{
    booking: Booking;
    kind: "checkout" | "return";
  } | null>(null);
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("0");
  const load = useCallback(async () => {
    if (user?.role !== "Admin") return;
    setBusy(true);
    setError("");
    try {
      const [overview, rentals, fleet, activity] = await Promise.all([
        api<Dashboard>("/api/admin/dashboard"),
        api<Booking[]>("/api/bookings"),
        api<Vehicle[]>("/api/vehicles"),
        api<Notice[]>("/api/admin/notifications"),
      ]);
      setDashboard(overview);
      setBookings(rentals);
      setVehicles(fleet);
      setNotices(activity);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, user?.role]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function submit() {
    if (!action) return;
    if (
      !odometer ||
      !Number.isInteger(Number(odometer)) ||
      Number(odometer) < 0 ||
      !Number.isFinite(Number(fee)) ||
      Number(fee) < 0
    ) {
      setError("Vérifiez le kilométrage et les frais.");
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      await api(`/api/admin/bookings/${action.booking.id}/${action.kind}`, {
        method: "POST",
        body: JSON.stringify({
          odometer: Number(odometer),
          notes,
          damageFee: Number(fee),
        }),
      });
      setAction(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  function begin(booking: Booking, kind: "checkout" | "return") {
    setError("");
    setOdometer("");
    setNotes("");
    setFee("0");
    setAction({ booking, kind });
  }
  async function review(booking: Booking, approve: boolean) {
    if (actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      await api(`/api/admin/bookings/${booking.id}/review`, {
        method: "POST",
        body: JSON.stringify({ approve, note: reviewNotes[booking.id] || "" }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  async function removeVehicle() {
    if (!removing || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      await api(`/api/admin/vehicles/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  if (user?.role !== "Admin")
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Espace administrateur.</Text>
        <Text style={styles.body}>
          Connectez-vous avec un compte administrateur pour gérer l’agence.
        </Text>
        <Button title="Me connecter" onPress={() => router.push("/auth")} />
      </View>
    );
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
            {fixedTab === "bookings"
              ? "Demandes clients"
              : fixedTab === "fleet"
                ? "Gestion des voitures"
                : "Administration"}
          </Text>
          {!fixedTab && (
            <Chips
              value={tab}
              onChange={setTab}
              options={[
                { label: "Vue d’ensemble", value: "dashboard" },
                { label: "Réservations", value: "bookings" },
                { label: "Flotte", value: "fleet" },
                { label: "Rentabilité", value: "profitability" },
                { label: "Activité", value: "activity" },
              ]}
            />
          )}
          <Button secondary title="Actualiser" busy={busy} onPress={load} />
          <ErrorMessage message={error} />
          {tab === "profitability" && <Profitability />}
          {busy && !dashboard && <Loading />}
          {tab === "dashboard" && dashboard && (
            <>
              {dashboard.operations && (
                <View style={styles.card}>
                  <Text style={styles.heading}>À traiter en agence</Text>
                  {dashboard.operations.map(({ kind, count, items }) => (
                    <View key={kind} style={{ gap: 8 }}>
                      <Text style={styles.body}>
                        {operationLabels[kind].title} · {count}
                      </Text>
                      {items.map((item) => (
                        <View key={item.reference} style={styles.card}>
                          <Text style={styles.heading}>{item.vehicleName}</Text>
                          <Text style={styles.small}>
                            {dateLabel(item.date)} · {item.location}
                          </Text>
                          <Button
                            secondary
                            title={`Ouvrir ${item.reference}`}
                            onPress={() => {
                              setQuery(item.reference);
                              setStatus("");
                              setTab("bookings");
                            }}
                          />
                        </View>
                      ))}
                      {count > items.length && (
                        <Button
                          secondary
                          title="Ouvrir les locations"
                          onPress={() => {
                            setQuery("");
                            setStatus(operationLabels[kind].status);
                            setTab("bookings");
                          }}
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}
              {[
                [
                  money(dashboard.totalRevenue),
                  "Chiffre d’affaires encaissé (hors remboursements)",
                ],
                [String(dashboard.totalBookings), "Réservations"],
                [String(dashboard.activeRentals), "Locations en cours"],
                [String(dashboard.availableVehicles), "Véhicules disponibles"],
              ].map(([value, label]) => (
                <View key={label} style={styles.card}>
                  <Text style={styles.body}>{label}</Text>
                  <Text style={styles.title}>{value}</Text>
                </View>
              ))}
              <View style={styles.card}>
                <Text style={styles.heading}>Les six derniers mois</Text>
                {dashboard.monthlyRevenue.map((month) => (
                  <View key={month.month} style={{ gap: 7 }}>
                    <View style={styles.between}>
                      <Text style={styles.body}>{month.month}</Text>
                      <Text style={styles.body}>{money(month.revenue)}</Text>
                    </View>
                    <View
                      style={{
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: "#86A45B",
                          width: `${Math.max(1, (month.revenue / Math.max(1, ...dashboard.monthlyRevenue.map((item) => item.revenue))) * 100)}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
          {tab === "bookings" && (
            <>
              <Text style={styles.body}>
                Acceptez ou refusez les demandes clients, puis suivez les
                départs et retours.
              </Text>
              <Chips
                value={status}
                onChange={setStatus}
                options={[
                  { value: "", label: "Toutes" },
                  ...[
                    "Pending",
                    "Confirmed",
                    "Rejected",
                    "Active",
                    "Completed",
                    "Cancelled",
                  ].map((value) => ({
                    value,
                    label: statusLabel[value as keyof typeof statusLabel],
                  })),
                ]}
              />
              <Field
                label="Rechercher une réservation"
                value={query}
                onChangeText={setQuery}
                placeholder="Référence, client, véhicule…"
              />
              {bookings
                .filter((booking) => !status || booking.status === status)
                .filter((booking) =>
                  `${booking.reference} ${booking.userName} ${booking.vehicleName}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((booking) => (
                  <View key={booking.id} style={styles.card}>
                    <Text style={styles.label}>{booking.reference}</Text>
                    <Text style={styles.heading}>{booking.vehicleName}</Text>
                    <Text style={styles.body}>
                      {booking.userName}
                      {"\n"}
                      {dateLabel(booking.startDate)} →{" "}
                      {dateLabel(booking.endDate)}
                    </Text>
                    <Text style={styles.body}>
                      {statusLabel[booking.status]} ·{" "}
                      {money(booking.total + booking.damageFee)}
                    </Text>
                    <Text style={styles.small}>
                      {booking.userEmail}
                      {"\n"}
                      {booking.pickupLocationName} →{" "}
                      {booking.returnLocationName}
                    </Text>
                    {Boolean(
                      booking.contactEmail || booking.contactWhatsApp,
                    ) && (
                      <Text style={styles.small}>
                        Contrat ({booking.contractDeliveryChannel}) :{" "}
                        {booking.contactWhatsApp || booking.contactEmail}
                        {"\n"}
                        {contractEmailLabel(booking.contractEmailStatus)}
                      </Text>
                    )}
                    {["Failed", "WaitingConfiguration"].includes(
                      booking.contractEmailStatus,
                    ) && (
                      <Button
                        title="Réessayer l’envoi du contrat"
                        disabled={actionBusy}
                        onPress={async () => {
                          setActionBusy(true);
                          try {
                            await api(
                              `/api/admin/bookings/${booking.id}/contract-email/retry`,
                              { method: "POST" },
                            );
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setActionBusy(false);
                          }
                        }}
                      />
                    )}
                    {Boolean(booking.reviewNote) && (
                      <Text style={styles.small}>
                        Message au client : {booking.reviewNote}
                      </Text>
                    )}
                    {["Confirmed", "Active", "Completed"].includes(
                      booking.status,
                    ) &&
                      Boolean(booking.contactWhatsApp) && (
                        <Button
                          title="Envoyer le contrat sur WhatsApp"
                          secondary
                          disabled={actionBusy}
                          onPress={() => setManualWhatsApp(booking)}
                        />
                      )}
                    {booking.status === "Pending" && (
                      <>
                        <Field
                          label="Message au client (facultatif)"
                          value={reviewNotes[booking.id] || ""}
                          onChangeText={(value) =>
                            setReviewNotes({
                              ...reviewNotes,
                              [booking.id]: value,
                            })
                          }
                          maxLength={1000}
                        />
                        <Button
                          title="Accepter la demande"
                          disabled={actionBusy}
                          onPress={() => void review(booking, true)}
                        />
                        <Button
                          title="Refuser la demande"
                          danger
                          disabled={actionBusy}
                          onPress={() => void review(booking, false)}
                        />
                      </>
                    )}
                    {booking.status === "Confirmed" && (
                      <Button
                        title="Enregistrer le départ"
                        onPress={() => begin(booking, "checkout")}
                      />
                    )}
                    {booking.status === "Active" && (
                      <Button
                        title="Enregistrer le retour"
                        secondary
                        onPress={() => begin(booking, "return")}
                      />
                    )}
                  </View>
                ))}
              {!bookings.some(
                (b) =>
                  (!status || b.status === status) &&
                  `${b.reference} ${b.userName} ${b.vehicleName}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              ) && (
                <Text style={styles.body}>
                  Aucune demande dans cette sélection.
                </Text>
              )}
            </>
          )}
          {tab === "fleet" && (
            <>
              <Button
                title="Ajouter un véhicule"
                onPress={() => router.push("/admin-vehicle")}
              />
              {vehicles.map((vehicle) => (
                <View key={vehicle.id} style={styles.card}>
                  <Image
                    source={{ uri: vehicle.imageUrl }}
                    style={{ height: 170, borderRadius: 12 }}
                    accessibilityLabel={`${vehicle.brand} ${vehicle.model}`}
                  />
                  <Text style={styles.heading}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                  <Text style={styles.body}>
                    {statusLabel[vehicle.status]} · {vehicle.city}
                    {"\n"}
                    {money(vehicle.dailyRate)} / jour
                  </Text>
                  <Button
                    title="Modifier le véhicule"
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: "/admin-vehicle",
                        params: { id: String(vehicle.id) },
                      })
                    }
                  />
                  <Button
                    title={`Supprimer ${vehicle.brand} ${vehicle.model}`}
                    danger
                    disabled={actionBusy}
                    onPress={() => {
                      setRemoving(vehicle);
                      setError("");
                    }}
                  />
                </View>
              ))}
            </>
          )}
          {tab === "activity" && (
            <>
              {!notices.length && (
                <Text style={styles.body}>
                  L’activité de votre agence apparaîtra ici.
                </Text>
              )}
              {notices.map((notice) => (
                <View key={notice.id} style={styles.card}>
                  <Text style={styles.heading}>{notice.title}</Text>
                  <Text style={styles.body}>{notice.message}</Text>
                  <Text style={styles.small}>
                    {new Date(notice.createdAt).toLocaleString("fr-FR")}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
      {manualWhatsApp && (
        <ManualWhatsApp
          booking={manualWhatsApp}
          onClose={() => {
            setManualWhatsApp(null);
            void load();
          }}
        />
      )}
      <Modal
        visible={Boolean(removing)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!actionBusy) setRemoving(null);
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
            <Text style={styles.heading}>Supprimer cette voiture ?</Text>
            <Text style={styles.body}>
              {removing?.brand} {removing?.model}
              {"\n"}La voiture sera retirée de la flotte. Les anciens contrats
              seront conservés. Une voiture avec des locations confirmées ou en
              cours ne peut pas être supprimée.
            </Text>
            <ErrorMessage message={error} />
            <Button
              title="Confirmer la suppression de la voiture"
              danger
              busy={actionBusy}
              onPress={() => void removeVehicle()}
            />
            <Button
              title="Garder cette voiture"
              secondary
              disabled={actionBusy}
              onPress={() => setRemoving(null)}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={action !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!actionBusy) setAction(null);
        }}
      >
        <ScrollView
          style={{ backgroundColor: "#102A22DD" }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 22,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.heading}>
              {action?.kind === "checkout"
                ? "Enregistrer le départ"
                : "Bon retour parmi nous"}
            </Text>
            <Text style={styles.body}>{action?.booking.reference}</Text>
            <Field
              label="Kilométrage"
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="numeric"
            />
            {action?.kind === "return" && (
              <>
                <Field
                  label="État du véhicule / notes"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={2000}
                />
                <Field
                  label="Frais de dommages (MAD)"
                  value={fee}
                  onChangeText={setFee}
                  keyboardType="decimal-pad"
                />
              </>
            )}
            <ErrorMessage message={error} />
            <Button title="Confirmer" busy={actionBusy} onPress={submit} />
            <Button
              secondary
              title="Fermer"
              disabled={actionBusy}
              onPress={() => setAction(null)}
            />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}
