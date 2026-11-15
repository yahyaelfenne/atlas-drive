import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../../lib/session";
import {
  day,
  money,
  type Agency,
  type Booking,
  type Quote,
  type Vehicle,
} from "../../lib/types";
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
import { randomUUID } from "expo-crypto";
import {
  TestCardFields,
  cardError,
  emptyCard,
} from "../../components/TestCardFields";
export default function VehicleDetail() {
  const { id, startDate, endDate } = useLocalSearchParams<{
    id: string;
    startDate?: string;
    endDate?: string;
  }>();
  const { api, user } = useApp();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [start, setStart] = useState(startDate || day(1));
  const [end, setEnd] = useState(endDate || day(4));
  const [insurance, setInsurance] = useState<"basic" | "premium">("basic");
  const [childSeat, setChildSeat] = useState(false);
  const [additionalDriver, setAdditionalDriver] = useState(false);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [agreementKey, setAgreementKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ key: string; price: Quote } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Booking | null>(null);
  const [card, setCard] = useState(emptyCard);
  const [requestKey] = useState(randomUUID);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Vehicle>(`/api/vehicles/${id}`),
      api<Agency[]>("/api/locations"),
    ])
      .then(([car, locations]) => {
        if (!active) return;
        setVehicle(car);
        setAgencies(locations);
        const agency = locations.find((location) => location.city === car.city);
        setPickup(agency ? String(agency.id) : "");
        setDestination(agency ? String(agency.id) : "");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, id]);
  const quoteInput = {
    vehicleId: Number(id),
    startDate: start,
    endDate: end,
    insurance,
    childSeat,
    additionalDriver,
  };
  const quoteKey = JSON.stringify(quoteInput);
  const agreed = agreementKey === quoteKey;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setQuoteError("");
      api<Quote>("/api/quotes", {
        method: "POST",
        body: quoteKey,
        signal: controller.signal,
      })
        .then((price) => {
          if (!controller.signal.aborted) setQuote({ key: quoteKey, price });
        })
        .catch((e) => {
          if (!controller.signal.aborted) setQuoteError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, quoteKey]);
  async function reserve() {
    if (user?.role === "Admin") {
      setError("Un administrateur ne peut pas louer de voiture.");
      return;
    }
    if (!user) {
      router.push("/auth");
      return;
    }
    if (busy) return;
    const paymentError = cardError(card);
    if (paymentError) {
      setError(paymentError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const booking = await api<Booking>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          ...quoteInput,
          pickupLocationId: Number(pickup),
          returnLocationId: Number(destination),
          notes,
          payment: card,
          requestKey,
        }),
      });
      setCard(emptyCard);
      setSuccess(booking);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.role === "Admin")
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Gestion des voitures</Text>
        <Text style={styles.body}>
          Les locations sont réservées aux clients. Utilisez Voitures pour
          ajouter, modifier ou supprimer un véhicule.
        </Text>
        <Button
          title="Gérer les voitures"
          onPress={() => router.replace("/fleet")}
        />
      </View>
    );
  if (success)
    return (
      <View style={[styles.content, { paddingTop: 50 }]}>
        <Text style={styles.label}>PAIEMENT TEST ACCEPTÉ · AUCUN DÉBIT</Text>
        <Text style={styles.title}>Votre demande est envoyée.</Text>
        <Text style={styles.body}>
          Demande {success.reference} envoyée. En attente de validation par
          l’admin.
        </Text>
        <Text style={styles.heading}>{money(success.total)}</Text>
        <Button
          title="Suivre ma demande"
          onPress={() => router.replace("/bookings")}
        />
        <DemoNote />
      </View>
    );
  if (!vehicle)
    return error ? (
      <View style={styles.content}>
        <ErrorMessage message={error} />
      </View>
    ) : (
      <Loading />
    );
  const price = quote?.key === quoteKey ? quote.price : null;
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={{
              height: 235,
              borderRadius: 23,
              backgroundColor: colors.border,
            }}
          />
          <Text style={styles.small}>
            Photo illustrative · le modèle présenté peut différer.
          </Text>
          <Text style={styles.label}>
            {vehicle.category} · {vehicle.city}
          </Text>
          <Text style={styles.title}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <Text style={styles.body}>{vehicle.description}</Text>
          <Text style={styles.body}>
            {vehicle.seats} places · {vehicle.transmission} · {vehicle.fuel} ·{" "}
            {vehicle.year}
          </Text>
          <Text style={styles.small}>{vehicle.features.join(" · ")}</Text>
          <View style={styles.card}>
            <Text style={styles.heading}>
              {money(vehicle.dailyRate)} / jour
            </Text>
            <DateField
              label="Date de départ"
              value={start}
              onChange={setStart}
              minimum={day()}
            />
            <DateField
              label="Date de retour"
              value={end}
              onChange={setEnd}
              minimum={start}
            />
            <Text style={styles.label}>Agence de départ</Text>
            <Chips
              options={agencies
                .filter((a) => a.city === vehicle.city)
                .map((a) => ({ label: a.name, value: String(a.id) }))}
              value={pickup}
              onChange={setPickup}
            />
            <Text style={styles.label}>Agence de retour</Text>
            <Chips
              options={agencies.map((a) => ({
                label: a.name,
                value: String(a.id),
              }))}
              value={destination}
              onChange={setDestination}
            />
            <Text style={styles.label}>Votre tranquillité</Text>
            <Chips
              options={[
                { label: "Base incluse", value: "basic" },
                { label: "Premium · 90 MAD/j", value: "premium" },
              ]}
              value={insurance}
              onChange={(value) => setInsurance(value as "basic" | "premium")}
            />
            <View style={styles.between}>
              <Text style={[styles.body, { flex: 1 }]}>
                Siège enfant · 35 MAD/j
              </Text>
              <Switch
                accessibilityLabel="Siège enfant"
                value={childSeat}
                onValueChange={setChildSeat}
                trackColor={{ true: colors.ink }}
              />
            </View>
            <View style={styles.between}>
              <Text style={[styles.body, { flex: 1 }]}>
                Conducteur supplémentaire · 50 MAD/j
              </Text>
              <Switch
                accessibilityLabel="Conducteur supplémentaire"
                value={additionalDriver}
                onValueChange={setAdditionalDriver}
                trackColor={{ true: colors.ink }}
              />
            </View>
            <Field
              label="Une précision ?"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={2000}
              placeholder="Heure d’arrivée, remarque…"
            />
          </View>
          <ErrorMessage message={quoteError} />
          {price ? (
            <View style={[styles.card, { backgroundColor: "#EFF3E6" }]}>
              <Text style={styles.body}>
                {price.days} jour(s) × {money(price.dailyRate)} ={" "}
                {money(price.rentalAmount)}
              </Text>
              <Text style={styles.body}>
                Assurance {money(price.insuranceAmount)} · Options{" "}
                {money(price.extrasAmount)}
              </Text>
              <View style={styles.between}>
                <Text style={styles.heading}>Total</Text>
                <Text style={styles.heading}>{money(price.total)}</Text>
              </View>
              <Text style={styles.small}>
                Caution remboursable de {money(price.deposit)}, séparée du
                total.
              </Text>
            </View>
          ) : (
            !quoteError && <Loading />
          )}
          {user && (
            <TestCardFields value={card} onChange={setCard} disabled={busy} />
          )}
          <View style={styles.row}>
            <Switch
              accessibilityLabel="Je confirme les dates, le prix et la caution"
              value={agreed}
              onValueChange={(value) =>
                setAgreementKey(value ? quoteKey : null)
              }
              trackColor={{ true: colors.ink }}
            />
            <Text style={[styles.small, { flex: 1 }]}>
              Je confirme les dates, le prix et la caution. Après validation
              admin, le contrat sera disponible dans mon espace.
            </Text>
          </View>
          <ErrorMessage message={error} />
          <Button
            title={
              user
                ? "Payer en test et envoyer la demande"
                : "Me connecter pour réserver"
            }
            busy={busy}
            disabled={
              !price || !pickup || !destination || (Boolean(user) && !agreed)
            }
            onPress={reserve}
          />
          <Text style={[styles.small, { textAlign: "center" }]}>
            Paiement simulé avant la demande. En cas de refus admin,
            remboursement simulé. Aucun débit réel.
          </Text>
          <DemoNote />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
