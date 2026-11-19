import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Fuel,
  Gauge,
  Info,
  Loader2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Booking, Location, Quote, User, Vehicle } from "./lib";
import { day, money, post } from "./lib";
import { Modal } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input, Select } from "./components/ui/input";
export function VehicleBooking({
  vehicle: v,
  open,
  onClose,
  user,
  onLogin,
  locations,
  startDate: initialStart,
  endDate: initialEnd,
  onReserved,
}: {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
  user: User | null;
  onLogin: () => void;
  locations: Location[];
  startDate: string;
  endDate: string;
  onReserved: (booking: Booking) => void;
}) {
  const [startDate, setStartDate] = useState(initialStart),
    [endDate, setEndDate] = useState(initialEnd),
    [pickup, setPickup] = useState(
      String(
        locations.find((l) => l.city === v.city)?.id || locations[0]?.id || "",
      ),
    ),
    [returnLocation, setReturn] = useState(
      String(
        locations.find((l) => l.city === v.city)?.id || locations[0]?.id || "",
      ),
    ),
    [insurance, setInsurance] = useState("basic"),
    [childSeat, setChildSeat] = useState(false),
    [additionalDriver, setAdditionalDriver] = useState(false),
    [notes, setNotes] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [quoting, setQuoting] = useState(false),
    [error, setError] = useState(""),
    [quoteError, setQuoteError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [contractDeliveryChannel, setContractDeliveryChannel] = useState<
    "email" | "whatsapp"
  >("whatsapp");
  const [contactWhatsApp, setContactWhatsApp] = useState("+212");
  const [whatsAppConsent, setWhatsAppConsent] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const lock = useRef(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let cancelled = false;
    setQuoting(true);
    setQuote(null);
    setQuoteError("");
    const timer = setTimeout(
      () =>
        post<Quote>("/api/quotes", {
          vehicleId: v.id,
          startDate,
          endDate,
          insurance,
          childSeat,
          additionalDriver,
        })
          .then((q) => {
            if (!cancelled) setQuote(q);
          })
          .catch((e) => {
            if (!cancelled) setQuoteError(e.message);
          })
          .finally(() => {
            if (!cancelled) setQuoting(false);
          }),
      200,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [v.id, startDate, endDate, insurance, childSeat, additionalDriver]);
  async function reserve(e: FormEvent) {
    e.preventDefault();
    if (user?.role === "Admin") {
      setError("Un administrateur ne peut pas louer de voiture.");
      return;
    }
    if (!user) {
      onLogin();
      return;
    }
    if (busy) return;
    if (!quote || !accepted) return;
    if (
      contractDeliveryChannel === "whatsapp" &&
      (!/^\+[1-9]\d{7,14}$/.test(contactWhatsApp.replace(/[\s().-]/g, "")) ||
        !whatsAppConsent)
    ) {
      setError(
        "Indiquez le numéro avec l’indicatif (+212…) et autorisez l’envoi sur WhatsApp.",
      );
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const booking = await post<Booking>("/api/bookings", {
        vehicleId: v.id,
        startDate,
        endDate,
        pickupLocationId: Number(pickup),
        returnLocationId: Number(returnLocation),
        insurance,
        childSeat,
        additionalDriver,
        notes,
        requestKey,
        contactEmail:
          contractDeliveryChannel === "email" ? contactEmail.trim() : "",
        contractDeliveryChannel,
        contactWhatsApp,
        whatsAppConsent,
      });
      onReserved(booking);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (user?.role === "Admin")
    return (
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
        title="Gestion des voitures"
        description="Les comptes administrateurs ne peuvent pas louer de voiture."
      >
        <Button asChild>
          <a href="#fleet" onClick={onClose}>
            Gérer la flotte
          </a>
        </Button>
      </Modal>
    );
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`${v.brand} ${v.model}`}
      description={`${v.category} · ${v.year} · Votre prochaine escapade vous attend.`}
      wide
    >
      <div className="booking-layout">
        <div className="vehicle-detail">
          <img
            className="detail-photo"
            src={v.imageUrl || "/images/hero-porsche.jpg"}
            alt={`${v.brand} ${v.model}`}
            onError={(e) => {
              e.currentTarget.src = "/images/hero-porsche.jpg";
            }}
          />
          <div className="detail-rating">
            <span>
              Photo illustrative{" "}
              <small>Le modèle présenté peut différer.</small>
            </span>
            <span>
              <MapPin size={14} />
              {v.city}
            </span>
          </div>
          <p className="detail-description">{v.description}</p>
          <div className="detail-specs">
            <div>
              <Gauge />
              <span>{v.transmission}</span>
            </div>
            <div>
              <Users />
              <span>{v.seats} places</span>
            </div>
            <div>
              <Fuel />
              <span>{v.fuel}</span>
            </div>
            <div>
              <CalendarDays />
              <span>{v.year}</span>
            </div>
          </div>
          <h4>Pour un voyage confortable</h4>
          <div className="feature-list">
            {v.features.map((f) => (
              <span key={f}>
                <Check size={15} />
                {f}
              </span>
            ))}
          </div>
          <div className="detail-insurance">
            <ShieldCheck size={22} />
            <div>
              <strong>Prenez la route en confiance.</strong>
              <p>
                Assurance de base incluse. Caution remboursable de{" "}
                {money(v.deposit)}, selon l’état du véhicule au retour.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={reserve} className="booking-form">
          <div className="booking-form-head">
            <span>Votre location</span>
            <div>
              <strong>{money(v.dailyRate)}</strong>
              <small> / jour</small>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Départ
              <Input
                type="date"
                min={day()}
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              Retour
              <Input
                type="date"
                min={startDate}
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <label>
            Agence de départ
            <Select
              value={pickup}
              required
              onChange={(e) => {
                setPickup(e.target.value);
                setReturn(e.target.value);
              }}
            >
              <option value="" disabled>
                Sélectionner une agence
              </option>
              {locations
                .filter((l) => l.city === v.city)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Agence de retour
            <Select
              value={returnLocation}
              required
              onChange={(e) => setReturn(e.target.value)}
            >
              <option value="" disabled>
                Sélectionner une agence
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
          <fieldset className="insurance-options">
            <legend>Votre tranquillité</legend>
            <label
              className={
                insurance === "basic" ? "option-card checked" : "option-card"
              }
            >
              <input
                type="radio"
                name="insurance"
                checked={insurance === "basic"}
                onChange={() => setInsurance("basic")}
              />
              <span>
                <strong>Assurance de base</strong>
                <small>Incluse dans votre location</small>
              </span>
              <b>Incluse</b>
            </label>
            <label
              className={
                insurance === "premium" ? "option-card checked" : "option-card"
              }
            >
              <input
                type="radio"
                name="insurance"
                checked={insurance === "premium"}
                onChange={() => setInsurance("premium")}
              />
              <span>
                <strong>Protection Premium</strong>
                <small>Couverture complémentaire</small>
              </span>
              <b>
                90 MAD<small>/ jour</small>
              </b>
            </label>
          </fieldset>
          <div className="extras-options">
            <label>
              <input
                type="checkbox"
                checked={childSeat}
                onChange={(e) => setChildSeat(e.target.checked)}
              />
              <span>Siège enfant</span>
              <small>35 MAD / jour</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={additionalDriver}
                onChange={(e) => setAdditionalDriver(e.target.checked)}
              />
              <span>Conducteur additionnel</span>
              <small>50 MAD / jour</small>
            </label>
          </div>
          <label>
            Recevoir mon contrat par
            <Select
              value={contractDeliveryChannel}
              onChange={(e) =>
                setContractDeliveryChannel(
                  e.target.value as "email" | "whatsapp",
                )
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </Select>
          </label>
          {contractDeliveryChannel === "whatsapp" ? (
            <>
              <label>
                Numéro WhatsApp
                <Input
                  type="tel"
                  required
                  maxLength={24}
                  value={contactWhatsApp}
                  onChange={(e) => setContactWhatsApp(e.target.value)}
                  placeholder="+212612345678"
                  autoComplete="tel"
                />
              </label>
              <label className="accept-terms">
                <input
                  type="checkbox"
                  required
                  checked={whatsAppConsent}
                  onChange={(e) => setWhatsAppConsent(e.target.checked)}
                />
                <span>
                  J’accepte de recevoir mon contrat et les informations de cette
                  réservation sur WhatsApp à ce numéro.
                </span>
              </label>
              <small>
                Après acceptation admin, l’agence pourra vous transmettre votre
                contrat sur WhatsApp. Vérifiez soigneusement le numéro indiqué.
              </small>
            </>
          ) : (
            <label>
              E-mail pour recevoir le contrat
              <Input
                type="email"
                required
                maxLength={254}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                autoComplete="email"
                placeholder="vous@exemple.com"
              />
            </label>
          )}
          <label>
            Une précision ? <span className="muted">(facultatif)</span>
            <textarea
              className="input"
              rows={2}
              maxLength={1000}
              placeholder="Heure d’arrivée, besoin particulier…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="quote-summary" aria-live="polite">
            {quoting ? (
              <div className="quote-loading">
                <Loader2 size={18} className="spin" /> Calcul de votre tarif…
              </div>
            ) : quoteError ? (
              <div className="form-error">{quoteError}</div>
            ) : (
              quote && (
                <>
                  <div>
                    <span>
                      {quote.days} jour{quote.days > 1 ? "s" : ""} ×{" "}
                      {money(quote.dailyRate)}
                    </span>
                    <span>{money(quote.rentalAmount)}</span>
                  </div>
                  <div>
                    <span>
                      Protection {insurance === "basic" ? "de base" : "Premium"}
                    </span>
                    <span>
                      {quote.insuranceAmount
                        ? money(quote.insuranceAmount)
                        : "Incluse"}
                    </span>
                  </div>
                  {quote.extrasAmount > 0 && (
                    <div>
                      <span>Vos options</span>
                      <span>{money(quote.extrasAmount)}</span>
                    </div>
                  )}
                  <div className="quote-total">
                    <strong>Total de votre location</strong>
                    <strong>{money(quote.total)}</strong>
                  </div>
                  <p>
                    <Info size={13} /> Caution remboursable :{" "}
                    {money(quote.deposit)} en agence.
                  </p>
                </>
              )
            )}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label className="accept-terms">
            <input
              type="checkbox"
              required
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Je confirme les dates, le tarif et la caution. Après validation
              admin, le contrat de location sera disponible dans mon espace.
            </span>
          </label>
          <Button
            type="submit"
            className="booking-submit"
            disabled={busy || quoting || !quote || !accepted}
          >
            {busy ? <Loader2 className="spin" size={18} /> : null}
            {user ? "Envoyer ma demande" : "Me connecter pour réserver"}
            <ArrowRight size={17} />
          </Button>
          <small className="payment-note">
            <ShieldCheck size={13} /> Votre demande sera examinée par l’admin.
            Le contrat sera disponible après son acceptation.
          </small>
        </form>
      </div>
    </Modal>
  );
}
