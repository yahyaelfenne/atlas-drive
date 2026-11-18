import { useRef, useState, type FormEvent } from "react";
import type { Booking, Quote, User, Vehicle } from "./lib";
import { money, post } from "./lib";
import { Button } from "./components/ui/button";
import { TestCardFields, cardError, emptyCard } from "./TestCardFields";
export type CheckoutDraft = {
  vehicle: Vehicle; quote: Quote; pickupName: string; returnName: string;
  input: { vehicleId: number; startDate: string; endDate: string; pickupLocationId: number;
    returnLocationId: number; insurance: string; childSeat: boolean; additionalDriver: boolean;
    notes: string; requestKey: string; contactEmail: string; contractDeliveryChannel: "email" | "whatsapp"; contactWhatsApp: string; whatsAppConsent: boolean; };
};
export function PaymentPage({ draft, user, onBack, onSuccess }: {
  draft: CheckoutDraft | null; user: User | null; onBack: () => void; onSuccess: (b: Booking) => void;
}) {
  const [card, setCard] = useState(emptyCard);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!draft || !user || user.role === "Admin" || lock.current) return;
    const invalid = cardError(card); if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError("");
    try { const booking = await post<Booking>("/api/bookings", { ...draft.input, payment: card });
      setCard(emptyCard); onSuccess(booking);
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="container" style={{ maxWidth: 760, padding: "48px 24px" }}>
    <p>Étape 2 sur 2</p><h1>Paiement par carte</h1>
    {!draft || !user || user.role === "Admin" ? <><p>Sélectionnez une voiture et vos dates depuis le catalogue pour continuer.</p><Button onClick={onBack}>Retour au catalogue</Button></> :
      <form className="booking-form" onSubmit={pay}>
        <h2>{draft.vehicle.brand} {draft.vehicle.model}</h2>
        <p>Du {draft.input.startDate} au {draft.input.endDate} · {draft.quote.days} jour(s)</p>
        <p>Départ : {draft.pickupName} · Retour : {draft.returnName}</p>
        <p>Protection {draft.input.insurance === "premium" ? "Premium" : "de base"}{draft.input.childSeat ? " · Siège enfant" : ""}{draft.input.additionalDriver ? " · Conducteur additionnel" : ""}</p>
        <div className="quote-total"><strong>Total à payer</strong><strong>{money(draft.quote.total)}</strong></div>
        <p>Contrat après acceptation par {draft.input.contractDeliveryChannel === "whatsapp" ? "WhatsApp" : "e-mail"} : <strong>{draft.input.contractDeliveryChannel === "whatsapp" ? draft.input.contactWhatsApp : draft.input.contactEmail}</strong></p>
        <p>Caution en agence : {money(draft.quote.deposit)}.</p>
        <TestCardFields value={card} onChange={setCard} disabled={busy} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <Button type="submit" disabled={busy}>{busy ? "Paiement en cours…" : "Payer en test et envoyer la demande"}</Button>
        <Button type="button" disabled={busy} onClick={onBack}>Retour à la location</Button>
        <p className="payment-note">Paiement simulé, aucun débit réel. La demande sera ensuite validée par l’admin. En cas de refus, remboursement simulé.</p>
      </form>}
  </section>;
}
