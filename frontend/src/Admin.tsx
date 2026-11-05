import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Bell,
  CarFront,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  FileText,
  Gauge,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { api, date, money, post, statusLabel } from "./lib";
import type { Booking, Dashboard, Notice, User, Vehicle } from "./lib";
import { Button } from "./components/ui/button";
import { Input, Select } from "./components/ui/input";
import { Modal } from "./components/ui/dialog";
import { openContract } from "./Reservations";
type Tab = "overview" | "bookings" | "fleet" | "notifications";
export function Admin({
  user,
  onLogin,
  notify,
  onFleetChange,
}: {
  user: User | null;
  onLogin: () => void;
  notify: (message: string) => void;
  onFleetChange: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview"),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<Vehicle | null | undefined>(undefined),
    [action, setAction] = useState<{
      booking: Booking;
      type: "checkout" | "return";
    } | null>(null),
    [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const load = useCallback(async () => {
    if (user?.role !== "Admin") return;
    setLoading(true);
    setError("");
    try {
      const [d, b, v, n] = await Promise.all([
        api<Dashboard>("/api/admin/dashboard"),
        api<Booking[]>("/api/bookings"),
        api<Vehicle[]>("/api/vehicles"),
        api<Notice[]>("/api/admin/notifications"),
      ]);
      setDashboard(d);
      setBookings(b);
      setVehicles(v);
      setNotices(n);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);
  async function removeVehicle() {
    if (!deleteVehicle) return;
    setBusy(true);
    try {
      await api(`/api/admin/vehicles/${deleteVehicle.id}`, {
        method: "DELETE",
      });
      setDeleteVehicle(null);
      notify("Le véhicule a été retiré de la flotte.");
      load();
      onFleetChange();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <section className="section-container empty-state page-empty">
        <LayoutDashboard />
        <h1>Votre agence, en un coup d’œil.</h1>
        <p>
          Connectez-vous avec votre compte administrateur pour gérer les
          locations.
        </p>
        <Button onClick={onLogin}>
          Me connecter <ArrowRight size={17} />
        </Button>
      </section>
    );
  if (user.role !== "Admin")
    return (
      <section className="section-container empty-state page-empty">
        <Users />
        <h1>Cet espace est réservé à l’équipe.</h1>
        <p>Retrouvez vos locations depuis votre espace voyageur.</p>
        <Button asChild>
          <a href="#bookings">
            Mes réservations <ArrowRight size={17} />
          </a>
        </Button>
      </section>
    );
  const filtered = bookings.filter(
    (b) =>
      (!status || b.status === status) &&
      `${b.reference} ${b.vehicleName} ${b.userName} ${b.userEmail}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="section-container page-section admin-section">
      <div className="eyebrow">ESPACE ADMINISTRATION</div>
      <div className="section-heading">
        <div>
          <h1>Gardez une longueur d’avance.</h1>
          <p>
            Réservations, flotte et retours. Tout ce qui fait rouler votre
            agence.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} /> Actualiser
        </Button>
      </div>
      <div className="admin-tabs">
        {(
          [
            { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
            { id: "bookings", label: "Réservations", icon: ClipboardList },
            { id: "fleet", label: "La flotte", icon: CarFront },
            { id: "notifications", label: "Activité", icon: Bell },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "selected" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={17} />
            {t.label}
            {t.id === "notifications" && notices.length > 0 && (
              <span>{notices.length}</span>
            )}
          </button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && !dashboard ? (
        <div className="loading-state">
          <Loader2 className="spin" /> Chargement de votre agence…
        </div>
      ) : (
        <>
          {tab === "overview" && dashboard && (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: "Chiffre d’affaires",
                    value: money(dashboard.totalRevenue),
                    icon: CircleDollarSign,
                    note: "Locations confirmées et réalisées",
                  },
                  {
                    label: "Réservations",
                    value: dashboard.totalBookings,
                    icon: ClipboardList,
                    note: "Tous les départs réunis",
                  },
                  {
                    label: "Locations en cours",
                    value: dashboard.activeRentals,
                    icon: Gauge,
                    note: "Vos véhicules sur la route",
                  },
                  {
                    label: "Véhicules disponibles",
                    value: dashboard.availableVehicles,
                    icon: CarFront,
                    note: "Prêts pour le prochain départ",
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.label}>
                    <div>
                      <span>{s.label}</span>
                      <s.icon size={18} />
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.note}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-panels">
                <div className="chart-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        L’ACTIVITÉ AU FIL DES MOIS
                      </span>
                      <h3>Chaque départ compte.</h3>
                    </div>
                    <TrendingUp size={21} />
                  </div>
                  <RevenueChart data={dashboard.monthlyRevenue} />
                </div>
                <div className="fleet-health">
                  <span className="eyebrow">VOTRE FLOTTE</span>
                  <h3>Prête à prendre la route.</h3>
                  <div className="health-ring">
                    <strong>
                      {dashboard.availableVehicles}
                      <small>disponibles</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <i />
                      {
                        vehicles.filter((v) => v.status === "Available").length
                      }{" "}
                      en service
                    </span>
                    <span>
                      <i className="maintenance" />
                      {
                        vehicles.filter((v) => v.status === "Maintenance")
                          .length
                      }{" "}
                      en maintenance
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => setTab("fleet")}>
                    Gérer les véhicules <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
              <div className="panel-heading bookings-heading">
                <div>
                  <span className="eyebrow">LES DERNIERS DÉPARTS</span>
                  <h3>Réservations récentes</h3>
                </div>
                <button
                  className="text-link"
                  onClick={() => setTab("bookings")}
                >
                  Tout voir <ArrowRight size={15} />
                </button>
              </div>
              <BookingTable
                bookings={dashboard.recentBookings}
                onAction={(booking, type) => setAction({ booking, type })}
                notify={notify}
              />
            </>
          )}
          {tab === "bookings" && (
            <>
              <div className="admin-toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <Input
                    aria-label="Rechercher une réservation"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Référence, client, véhicule…"
                  />
                </div>
                <Select
                  aria-label="Statut de réservation"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tous les statuts</option>
                  {["Confirmed", "Active", "Completed", "Cancelled"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ),
                  )}
                </Select>
                <span>
                  {filtered.length} réservation{filtered.length > 1 ? "s" : ""}
                </span>
              </div>
              <BookingTable
                bookings={filtered}
                onAction={(booking, type) => setAction({ booking, type })}
                notify={notify}
              />
            </>
          )}
          {tab === "fleet" && (
            <>
              <div className="admin-toolbar">
                <div>
                  <h3>Votre flotte, votre signature.</h3>
                  <p className="muted">
                    {vehicles.length} véhicules dans votre catalogue.
                  </p>
                </div>
                <Button onClick={() => setEdit(null)}>
                  <Plus size={17} /> Ajouter un véhicule
                </Button>
              </div>
              <div className="admin-fleet-grid">
                {vehicles.map((v) => (
                  <article className="admin-vehicle-card" key={v.id}>
                    <img
                      src={v.imageUrl || "/images/hero-porsche.jpg"}
                      alt={`${v.brand} ${v.model}`}
                    />
                    <div>
                      <span
                        className={
                          "status-badge " +
                          (v.status === "Available"
                            ? "confirmed"
                            : "maintenance")
                        }
                      >
                        {statusLabel[v.status] || v.status}
                      </span>
                      <h3>
                        {v.brand} {v.model}
                      </h3>
                      <p>
                        {v.category} · {v.city} · {v.year}
                      </p>
                      <div className="admin-vehicle-price">
                        <strong>
                          {money(v.dailyRate)}
                          <small> / jour</small>
                        </strong>
                        <span>{v.transmission}</span>
                      </div>
                      <div className="row-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEdit(v)}
                        >
                          <Edit3 size={14} /> Modifier
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteVehicle(v)}
                          aria-label={`Retirer ${v.brand} ${v.model}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "notifications" && (
            <div className="activity-list">
              {notices.length === 0 ? (
                <div className="empty-state">
                  <Bell />
                  <h3>Tout est calme pour le moment.</h3>
                  <p>Les nouvelles réservations et retours apparaîtront ici.</p>
                </div>
              ) : (
                notices.map((n) => (
                  <article key={n.id}>
                    <div className="activity-icon">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.message}</p>
                      <small>
                        {new Date(n.createdAt).toLocaleString("fr-FR")}
                      </small>
                    </div>
                    {!n.isRead && <span className="unread-dot" />}
                  </article>
                ))
              )}
            </div>
          )}
        </>
      )}
      {edit !== undefined && (
        <VehicleEditor
          vehicle={edit}
          onClose={() => setEdit(undefined)}
          onSuccess={() => {
            setEdit(undefined);
            notify(
              edit
                ? "Véhicule mis à jour."
                : "Nouveau véhicule ajouté à la flotte.",
            );
            load();
            onFleetChange();
          }}
        />
      )}
      {action && (
        <RentalAction
          booking={action.booking}
          type={action.type}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            notify(
              action.type === "checkout"
                ? "Départ enregistré. Bonne route !"
                : "Retour enregistré. Le véhicule est de nouveau disponible.",
            );
            load();
            onFleetChange();
          }}
        />
      )}
      <Modal
        open={!!deleteVehicle}
        onOpenChange={(v) => {
          if (!v) setDeleteVehicle(null);
        }}
        title="Retirer ce véhicule ?"
        description={`${deleteVehicle?.brand || ""} ${deleteVehicle?.model || ""} sera retiré du catalogue si aucune location ne bloque cette action.`}
      >
        <div className="modal-actions">
          <Button variant="outline" onClick={() => setDeleteVehicle(null)}>
            Conserver
          </Button>
          <Button variant="destructive" onClick={removeVehicle} disabled={busy}>
            {busy && <Loader2 className="spin" size={16} />}Retirer de la flotte
          </Button>
        </div>
      </Modal>
    </section>
  );
}
function RevenueChart({ data }: { data: Dashboard["monthlyRevenue"] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Chiffre d’affaires mensuel en MAD"
    >
      <div className="chart-axis">
        <span>{money(max)}</span>
        <span>{money(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="chart-bars">
        {data.map((d, i) => (
          <div className="chart-column" key={d.month}>
            <div className="chart-bar-area">
              <div
                className={
                  i === data.length - 1 ? "chart-bar highlight" : "chart-bar"
                }
                style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
                title={`${d.month} : ${money(d.revenue)}`}
              >
                <span>{money(d.revenue)}</span>
              </div>
            </div>
            <small>{d.month}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
function BookingTable({
  bookings,
  onAction,
  notify,
}: {
  bookings: Booking[];
  onAction: (booking: Booking, type: "checkout" | "return") => void;
  notify: (message: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Réservation / Client</th>
            <th>Véhicule</th>
            <th>Dates</th>
            <th>Total</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={6} className="table-empty">
                Aucune réservation à afficher.
              </td>
            </tr>
          ) : (
            bookings.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.reference}</strong>
                  <span>{b.userName}</span>
                  <small>{b.userEmail}</small>
                </td>
                <td>
                  <strong>{b.vehicleName}</strong>
                  <small>{b.pickupLocationName}</small>
                </td>
                <td>
                  <span>{date(b.startDate)}</span>
                  <small>
                    au {date(b.endDate)} · {b.days} j
                  </small>
                </td>
                <td>
                  <strong>{money(b.total)}</strong>
                </td>
                <td>
                  <span className={"status-badge " + b.status.toLowerCase()}>
                    {statusLabel[b.status] || b.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openContract(b, notify)}
                      aria-label={`Contrat ${b.reference}`}
                    >
                      <FileText size={16} />
                    </Button>
                    {b.status === "Confirmed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAction(b, "checkout")}
                      >
                        Départ <ArrowRight size={13} />
                      </Button>
                    )}
                    {b.status === "Active" && (
                      <Button size="sm" onClick={() => onAction(b, "return")}>
                        Retour <Check size={13} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function RentalAction({
  booking,
  type,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  type: "checkout" | "return";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [odometer, setOdometer] = useState(""),
    [notes, setNotes] = useState(""),
    [damageFee, setDamageFee] = useState("0"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/api/admin/bookings/${booking.id}/${type}`, {
        odometer: Number(odometer),
        notes,
        damageFee: Number(damageFee),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={
        type === "checkout"
          ? "Enregistrer le départ."
          : "Bon retour parmi nous."
      }
      description={`${booking.reference} · ${booking.vehicleName} · ${booking.userName}`}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Kilométrage au {type === "checkout" ? "départ" : "retour"}
          <Input
            autoFocus
            required
            type="number"
            min="0"
            step="1"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Ex. 42500"
          />
        </label>
        {type === "return" && (
          <>
            <label>
              État du véhicule / notes
              <textarea
                className="input"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Carburant, état général, remarques…"
              />
            </label>
            <label>
              Frais de dommages (MAD)
              <Input
                type="number"
                required
                min="0"
                step="0.01"
                value={damageFee}
                onChange={(e) => setDamageFee(e.target.value)}
              />
              <small>
                Ces frais seront ajoutés au montant final du contrat.
              </small>
            </label>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
        <Button disabled={busy}>
          {busy ? (
            <Loader2 className="spin" size={17} />
          ) : (
            <CheckCircle2 size={17} />
          )}
          Confirmer le {type === "checkout" ? "départ" : "retour"}
        </Button>
      </form>
    </Modal>
  );
}
function VehicleEditor({
  vehicle,
  onClose,
  onSuccess,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [v, setV] = useState<Omit<Vehicle, "id" | "rating">>(
      vehicle
        ? { ...vehicle }
        : {
            brand: "",
            model: "",
            year: new Date().getFullYear(),
            category: "Citadine",
            transmission: "Manuelle",
            fuel: "Essence",
            seats: 5,
            dailyRate: 350,
            deposit: 3000,
            imageUrl: "",
            city: "Casablanca",
            description: "",
            features: [],
            status: "Available",
          },
    ),
    [features, setFeatures] = useState(vehicle?.features.join(", ") || ""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const update = (key: keyof typeof v, value: string | number) =>
    setV((current) => ({ ...current, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/vehicles" + (vehicle ? `/${vehicle.id}` : ""), {
        method: vehicle ? "PUT" : "POST",
        body: JSON.stringify({
          ...v,
          features: features
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean),
        }),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api<{ url: string }>("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      update("imageUrl", result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={
        vehicle ? "Affinez les détails." : "Un nouveau compagnon de route."
      }
      description="Les informations seront visibles immédiatement dans le catalogue."
      wide
    >
      <form className="form-stack" onSubmit={save}>
        <div className="form-grid three-col">
          <label>
            Marque
            <Input
              required
              value={v.brand}
              onChange={(e) => update("brand", e.target.value)}
            />
          </label>
          <label>
            Modèle
            <Input
              required
              value={v.model}
              onChange={(e) => update("model", e.target.value)}
            />
          </label>
          <label>
            Année
            <Input
              type="number"
              required
              min="2000"
              max={new Date().getFullYear() + 1}
              value={v.year}
              onChange={(e) => update("year", Number(e.target.value))}
            />
          </label>
          <label>
            Catégorie
            <Select
              value={v.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {["Citadine", "Berline", "SUV", "Premium"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
          <label>
            Transmission
            <Select
              value={v.transmission}
              onChange={(e) => update("transmission", e.target.value)}
            >
              <option>Manuelle</option>
              <option>Automatique</option>
            </Select>
          </label>
          <label>
            Carburant
            <Select
              value={v.fuel}
              onChange={(e) => update("fuel", e.target.value)}
            >
              <option>Essence</option>
              <option>Diesel</option>
              <option>Hybride</option>
              <option>Électrique</option>
            </Select>
          </label>
          <label>
            Places
            <Input
              type="number"
              required
              min="2"
              max="9"
              value={v.seats}
              onChange={(e) => update("seats", Number(e.target.value))}
            />
          </label>
          <label>
            Tarif / jour (MAD)
            <Input
              type="number"
              required
              min="1"
              value={v.dailyRate}
              onChange={(e) => update("dailyRate", Number(e.target.value))}
            />
          </label>
          <label>
            Caution (MAD)
            <Input
              type="number"
              required
              min="0"
              value={v.deposit}
              onChange={(e) => update("deposit", Number(e.target.value))}
            />
          </label>
          <label>
            Ville
            <Select
              value={v.city}
              onChange={(e) => update("city", e.target.value)}
            >
              {["Casablanca", "Marrakech", "Rabat", "Agadir"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
          <label>
            État
            <Select
              value={v.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="Available">Disponible</option>
              <option value="Maintenance">Maintenance</option>
            </Select>
          </label>
        </div>
        <label>
          Description
          <textarea
            className="input"
            required
            rows={3}
            maxLength={2000}
            value={v.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </label>
        <label>
          Équipements <span className="muted">(séparés par des virgules)</span>
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Climatisation, Bluetooth, Caméra de recul"
          />
        </label>
        <label>
          URL de la photo
          <Input
            required
            type="url"
            value={v.imageUrl}
            onChange={(e) => update("imageUrl", e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="upload-row">
          <label className="upload-button">
            <Upload size={15} />
            {uploading ? "Envoi de la photo…" : "Importer via Cloudinary"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0]);
              }}
            />
          </label>
          <small>Nécessite la configuration Cloudinary du serveur.</small>
        </div>
        {v.imageUrl && (
          <img
            className="upload-preview"
            src={v.imageUrl}
            alt="Aperçu du véhicule"
          />
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={busy || uploading} type="submit">
            {busy && <Loader2 className="spin" size={16} />}Enregistrer le
            véhicule <Check size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
