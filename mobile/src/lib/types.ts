export interface User {
  id: string;
  fullName: string;
  email: string;
  role: "Admin" | "Customer";
}
export interface Session {
  token: string;
  user: User;
}
export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  year: number;
  category: string;
  transmission: string;
  fuel: string;
  seats: number;
  dailyRate: number;
  deposit: number;
  imageUrl: string;
  city: string;
  description: string;
  features: string[];
  status: "Available" | "Maintenance";
  rating: number;
}
export interface Agency {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
}
export interface QuoteInput {
  vehicleId: number;
  startDate: string;
  endDate: string;
  insurance: "basic" | "premium";
  childSeat: boolean;
  additionalDriver: boolean;
}
export interface Quote {
  days: number;
  dailyRate: number;
  rentalAmount: number;
  insuranceAmount: number;
  extrasAmount: number;
  total: number;
  deposit: number;
}
export interface Booking {
  id: number;
  reference: string;
  vehicleId: number;
  vehicleName: string;
  vehicleImageUrl: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  pickupLocationName: string;
  returnLocationName: string;
  days: number;
  dailyRate: number;
  total: number;
  deposit: number;
  status:
    | "Pending"
    | "Rejected"
    | "Confirmed"
    | "Active"
    | "Completed"
    | "Cancelled";
  contractDeliveryChannel: "email" | "whatsapp";
  contactWhatsApp: string;
  whatsAppMessageId: string | null;
  contactEmail: string;
  contractEmailStatus: string;
  contractEmailSentAt: string | null;
  paymentStatus: string;
  reviewNote: string;
  createdAt: string;
  returnedAt?: string;
  returnNotes?: string;
  damageFee: number;
}
export interface Dashboard {
  totalRevenue: number;
  totalBookings: number;
  activeRentals: number;
  availableVehicles: number;
  monthlyRevenue: { month: string; revenue: number }[];
  recentBookings: Booking[];
  operations?: {
    kind: "overdue" | "returns" | "pickups" | "missed" | "pending";
    count: number;
    items: {
      reference: string;
      vehicleName: string;
      date: string;
      location: string;
    }[];
  }[];
}
export const money = (amount: number) =>
  `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(amount)} MAD`;
export function day(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export const dateLabel = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const statusLabel = {
  Pending: "En attente de validation",
  Rejected: "Refusée",
  Confirmed: "Confirmée",
  Active: "En cours",
  Completed: "Terminée",
  Cancelled: "Annulée",
  Available: "Disponible",
  Maintenance: "Maintenance",
};
export const cities = ["Casablanca", "Marrakech", "Rabat", "Agadir"];
export const categories = ["Citadine", "Berline", "SUV", "Premium"];

export function contractEmailLabel(status: string) {
  return (
    (
      {
        NotQueued: "Le contrat sera envoyé après acceptation.",
        Pending: "Contrat : envoi en attente.",
        WaitingConfiguration:
          "Contrat : en attente de connexion du service d’envoi.",
        Sent: "Contrat envoyé au serveur de messagerie.",
        ManualRequired:
          "Contrat à envoyer manuellement sur WhatsApp par l’agence.",
        ManualPrepared:
          "Message WhatsApp préparé ; envoi manuel à confirmer par l’agence.",
        AcceptedByProvider:
          "Message accepté par WhatsApp ; réception non confirmée.",
        Uncertain:
          "Résultat d’envoi inconnu : l’agence doit vérifier avant de renvoyer.",
        Failed: "Envoi du contrat en échec : contactez l’agence.",
        Cancelled: "Envoi du contrat annulé.",
      } as Record<string, string>
    )[status] || ""
  );
}
