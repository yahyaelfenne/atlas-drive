import { useEffect, useState } from "react";
import { post, type Booking } from "./lib";
import { Modal } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { openContract } from "./Reservations";

type Prepared = { phone: string; message: string; whatsappUrl: string };
export function ManualWhatsApp({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    post<Prepared>(`/api/admin/bookings/${booking.id}/whatsapp/manual`)
      .then(value => { if (active) setPrepared(value); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [booking.id]);
  return <Modal open onOpenChange={open => { if (!open) onClose(); }} title="Envoyer le contrat sur WhatsApp" description={`Réservation ${booking.reference} · envoi manuel`}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!prepared && !error && <p>Préparation du message…</p>}
    {prepared && <>
      <p>Client : <strong>{booking.userName}</strong><br />WhatsApp : <strong>{prepared.phone}</strong></p>
      <p><strong>1.</strong> Ouvrez le contrat, puis choisissez « Imprimer / Enregistrer en PDF » et enregistrez le fichier.</p>
      <Button onClick={() => void openContract(booking, setError)}>1. Ouvrir le contrat / enregistrer le PDF</Button>
      <p><strong>2.</strong> Ouvrez la conversation du client. Joignez le PDF enregistré, puis appuyez sur « Envoyer » dans WhatsApp.</p>
      <Button asChild><a href={prepared.whatsappUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">2. Ouvrir WhatsApp avec le message</a></Button>
      <label>Message prérempli<textarea className="input" readOnly rows={7} value={prepared.message} /></label>
      <small>Le PDF n’est pas joint automatiquement. Ouvrir WhatsApp ne confirme ni l’envoi ni la réception du contrat.</small>
    </>}
    <div className="modal-actions"><Button variant="outline" onClick={onClose}>Fermer</Button></div>
  </Modal>;
}
