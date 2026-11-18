import type { Quote } from "./types";
export type CheckoutDraft = { userId: string; vehicleName: string; pickupName: string; returnName: string; quote: Quote;
  input: { vehicleId: number; startDate: string; endDate: string; insurance: string;
    childSeat: boolean; additionalDriver: boolean; pickupLocationId: number; returnLocationId: number;
    notes: string; requestKey: string; contactEmail: string; contractDeliveryChannel: "email" | "whatsapp"; contactWhatsApp: string; whatsAppConsent: boolean; };
};
let draft: CheckoutDraft | null = null;
export function setCheckout(value: CheckoutDraft | null) { draft = value; }
export function getCheckout() { return draft; }
