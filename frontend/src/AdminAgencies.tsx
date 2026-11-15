import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Location, type User } from "./lib";
import { Button } from "./components/ui/button";
import { Input, Select } from "./components/ui/input";
import { Modal } from "./components/ui/dialog";
const empty = {
  id: 0,
  name: "",
  city: "Casablanca",
  address: "",
  phone: "",
  latitude: "33.5926",
  longitude: "-7.6341",
};
export function AdminAgencies({
  user,
  onLocationsChange,
}: {
  user: User | null;
  onLocationsChange: (rows: Location[]) => void;
}) {
  const [agencies, setAgencies] = useState<Location[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<Location | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (user?.role !== "Admin") return;
    try {
      setAgencies(await api<Location[]>("/api/locations"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !form.latitude.trim() ||
        !form.longitude.trim() ||
        !Number.isFinite(Number(form.latitude)) ||
        !Number.isFinite(Number(form.longitude))
      )
        throw new Error("Vérifiez les coordonnées GPS.");
      await api(`/api/admin/locations${form.id ? `/${form.id}` : ""}`, {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      const rows = await api<Location[]>("/api/locations");
      setAgencies(rows);
      onLocationsChange(rows);
      setEditing(false);
      setForm(empty);
      setMessage("Bureau de location enregistré.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/locations/${removing.id}`, { method: "DELETE" });
      const rows = await api<Location[]>("/api/locations");
      setAgencies(rows);
      onLocationsChange(rows);
      setRemoving(null);
      setMessage("Bureau retiré des agences disponibles. Historique conservé.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.role !== "Admin")
    return (
      <section className="section-container page-section">
        <h1>Accès administrateur requis</h1>
      </section>
    );
  return (
    <section className="section-container page-section">
      <div className="eyebrow">ADMINISTRATION · AGENCES</div>
      <h1>Bureaux de location</h1>
      <p>Ajoutez, modifiez ou supprimez les emplacements de vos bureaux.</p>
      <div className="row-actions">
        <Button
          disabled={busy}
          onClick={() => {
            setForm(empty);
            setEditing(true);
            setError("");
          }}
        >
          Ajouter un bureau de location
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Actualiser les agences
        </Button>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {editing && (
        <form
          className="form-stack"
          style={{ maxWidth: 700, marginBlock: 28 }}
          onSubmit={save}
        >
          <h2>
            {form.id ? "Modifier le bureau" : "Nouveau bureau de location"}
          </h2>
          {(
            [
              ["name", "Nom du bureau"],
              ["address", "Adresse"],
              ["phone", "Téléphone"],
              ["latitude", "Latitude"],
              ["longitude", "Longitude"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <Input
                required
                value={form[key]}
                maxLength={key === "address" ? 300 : key === "name" ? 120 : 30}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Ville
            <Select
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              {["Casablanca", "Rabat", "Marrakech", "Agadir"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
          <Button type="submit" disabled={busy}>
            {form.id ? "Enregistrer les modifications" : "Publier le bureau"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Annuler
          </Button>
        </form>
      )}
      <h2>Agences publiées ({agencies.length})</h2>
      <div className="form-stack">
        {agencies.map((a) => (
          <article key={a.id} className="section-heading">
            <div>
              <h3>{a.name}</h3>
              <p>
                {a.address} · {a.city} · {a.phone}
              </p>
              <small>
                GPS : {a.latitude}, {a.longitude}
              </small>
            </div>
            <div className="row-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setForm({
                    ...a,
                    latitude: String(a.latitude),
                    longitude: String(a.longitude),
                  });
                  setEditing(true);
                  setError("");
                }}
              >
                Modifier {a.name}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setRemoving(a);
                  setError("");
                }}
              >
                Supprimer {a.name}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!agencies.length && <p>Aucun bureau publié.</p>}
      <Modal
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null);
        }}
        title="Supprimer ce bureau ?"
        description={`${removing?.name || ""} sera retiré des agences disponibles. L’historique sera conservé.`}
      >
        <div className="form-stack">
          <p>
            Un bureau lié à une demande ou location en cours ne peut pas être
            supprimé.
          </p>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <Button disabled={busy} onClick={() => void remove()}>
            Confirmer la suppression du bureau
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Garder ce bureau
          </Button>
        </div>
      </Modal>
    </section>
  );
}
