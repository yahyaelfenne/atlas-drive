import { useEffect, useRef, useState } from "react";
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
  const [contractDeliveryChannel, setContractDeliveryChannel] = useState<
    "email" | "whatsapp"
  >("whatsapp");
  const [contactWhatsApp, setContactWhatsApp] = useState("+212");
  const [whatsAppConsent, setWhatsAppConsent] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [notes, setNotes] = useState("");
  const [agreementKey, setAgreementKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ key: string; price: Quote } | null>(
    null,
  );
  const lock = useRef(false);
  const [requestKey] = useState(randomUUID);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
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
    if (
      !vehicle ||
      !quote ||
      quote.key !== quoteKey ||
      !agreed ||
      !pickup ||
      !destination
    )
      return;
    if (
      contractDeliveryChannel === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
    ) {
      setError(
        "Indiquez une adresse e-mail valide pour recevoir votre contrat.",
      );
      return;
    }
    if (
      contractDeliveryChannel === "whatsapp" &&
      (!/^\+[1-9]\d{7,14}$/.test(contactWhatsApp.replace(/[\s().-]/g, "")) ||
        !whatsAppConsent)
    ) {
      setError(
        "Indiquez votre numéro avec l’indicatif (+212…) et autorisez l’envoi sur WhatsApp.",
      );
      return;
    }
    if (lock.current) return;
    lock.current = true;
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
          contactEmail:
            contractDeliveryChannel === "email" ? contactEmail.trim() : "",
          contractDeliveryChannel,
          contactWhatsApp,
          whatsAppConsent,
          requestKey,
        }),
      });
      setSuccess(booking);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (success)
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Demande envoyée</Text>
        <Text style={styles.body}>
          Votre demande {success.reference} est en attente de validation par
          l’admin. Le contrat sera disponible après acceptation.
        </Text>
        <Button
          title="Voir mes réservations"
          onPress={() => router.replace("/bookings")}
        />
      </View>
    );
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
            <Text style={styles.label}>Recevoir mon contrat par</Text>
            <Chips
              value={contractDeliveryChannel}
              onChange={(v) =>
                setContractDeliveryChannel(v as "email" | "whatsapp")
              }
              options={[
                { label: "WhatsApp", value: "whatsapp" },
                { label: "E-mail", value: "email" },
              ]}
            />
            {contractDeliveryChannel === "whatsapp" ? (
              <>
                <Field
                  label="Numéro WhatsApp"
                  value={contactWhatsApp}
                  onChangeText={setContactWhatsApp}
                  keyboardType="phone-pad"
                  maxLength={24}
                  placeholder="+212612345678"
                />
                <View style={styles.row}>
                  <Switch
                    accessibilityLabel="J’accepte de recevoir mon contrat sur WhatsApp"
                    value={whatsAppConsent}
                    onValueChange={setWhatsAppConsent}
                  />
                  <Text style={[styles.small, { flex: 1 }]}>
                    J’accepte de recevoir mon contrat et les informations de
                    cette réservation sur WhatsApp à ce numéro.
                  </Text>
                </View>
                <Text style={styles.small}>
                  Après acceptation admin, l’agence pourra vous transmettre
                  votre contrat sur WhatsApp. Vérifiez votre numéro.
                </Text>
              </>
            ) : (
              <Field
                label="E-mail pour recevoir le contrat"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={254}
                placeholder="vous@exemple.com"
              />
            )}
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
            title={user ? "Envoyer ma demande" : "Me connecter pour réserver"}
            disabled={
              !price || !pickup || !destination || (Boolean(user) && !agreed)
            }
            busy={busy}
            onPress={reserve}
          />
          <Text style={[styles.small, { textAlign: "center" }]}>
            Votre demande sera examinée par l’admin. Le contrat sera disponible
            après son acceptation.
          </Text>
          <DemoNote />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
