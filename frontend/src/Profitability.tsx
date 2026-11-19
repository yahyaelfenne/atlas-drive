import { useCallback, useEffect, useRef, useState } from "react";
import { TrendingUp, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { api } from "./lib";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Modal } from "./components/ui/dialog";
import type {
  FinanceProfile,
  ProfitReport,
  ProfitRow,
} from "./profitability-types";

const money = (value: number) =>
  `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(value)} MAD`;

export function Profitability() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [includeTest, setIncludeTest] = useState(true);
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<ProfitRow | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const data = await api<ProfitReport>(
        `/api/admin/profitability?month=${month}&includeTest=${includeTest}`,
      );
      if (id === sequence.current) setReport(data);
    } catch (e) {
      if (id === sequence.current) {
        setReport(null);
        setError((e as Error).message);
      }
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [month, includeTest]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  return (
    <div className="profit-view">
      <div className="profit-heading">
        <div>
          <span className="eyebrow">CHAQUE VOITURE COMPTE</span>
          <h2>Votre flotte est-elle rentable ?</h2>
          <p>
            Les revenus acceptés et payés, face au crédit et aux charges du
            mois.
          </p>
        </div>
        <label className="profit-month">
          Mois étudié
          <Input
            aria-label="Mois étudié"
            type="month"
            value={month}
            required
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="profit-notice">
        <TrendingUp size={22} />
        <div>
          <strong>Une simulation, à affiner avec vos contrats.</strong>
          <p>
            Prix neufs indicatifs au Maroc, consultés le 19/11/2026. Hypothèses
            : apport 20 %, crédit 60 mois à 6,5 % annuel, début novembre 2026.
            Assurance et entretien sont des budgets estimés, sans devis.
            Finition et année peuvent différer de votre voiture.
          </p>
        </div>
      </div>
      <div className="profit-controls">
        <label>
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
          />{" "}
          Inclure les paiements de test{" "}
          <span className="profit-tag">
            {includeTest ? "SIMULATION" : "ENCAISSEMENTS RÉELS"}
          </span>
        </label>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "Chargement…" : "Actualiser les calculs"}
        </Button>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {report && (
        <>
          <div className="profit-stats">
            {[
              [
                "Revenus retenus",
                report.summary.revenue,
                "Locations acceptées et payées",
              ],
              [
                "Mensualités de crédit",
                report.summary.credit,
                "Uniquement pendant le financement",
              ],
              [
                "Charges budgétées",
                report.summary.costs,
                "Assurance, entretien et autres frais",
              ],
              [
                "Solde après charges",
                report.summary.balance,
                `${report.summary.configured}/${report.summary.total} voitures renseignées`,
              ],
            ].map(([label, value, note], i) => (
              <article
                key={String(label)}
                className={
                  i === 3 ? "profit-stat profit-stat-dark" : "profit-stat"
                }
              >
                <span>{label}</span>
                <strong>{money(Number(value))}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <p className="profit-explanation">
            Solde = revenus − mensualité − charges. Il s’agit d’un solde de
            trésorerie mensuel, hors apport initial, impôts, amortissement et
            frais exceptionnels. Revenus rattachés au mois de création du
            paiement ; une demande en attente ne compte pas. Les coûts manquants
            restent « À renseigner ».
          </p>
          <div className="profit-table-wrap">
            <table className="profit-table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Revenus</th>
                  <th>Crédit / mois</th>
                  <th>Charges / mois</th>
                  <th>Solde du mois</th>
                  <th>Seuil indicatif</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.vehicleId}>
                    <td>
                      <div className="profit-car">
                        <img src={row.imageUrl} alt="" />
                        <div>
                          <strong>{row.name}</strong>
                          <small>
                            {row.archived ? "Retirée de la flotte · " : ""}
                            {row.profile
                              ? row.profile.isEstimate
                                ? "Montants estimés"
                                : "Montants renseignés"
                              : "À renseigner"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{money(row.revenue)}</strong>
                      <small>
                        Réel : {money(row.realRevenue)}
                        <br />
                        Test : {money(row.testRevenue)}
                      </small>
                    </td>
                    <td>{row.credit === null ? "—" : money(row.credit)}</td>
                    <td>{row.costs === null ? "—" : money(row.costs)}</td>
                    <td>
                      <strong
                        className={
                          row.balance !== null && row.balance < 0
                            ? "profit-negative"
                            : "profit-positive"
                        }
                      >
                        {row.balance === null
                          ? "À renseigner"
                          : money(row.balance)}
                      </strong>
                    </td>
                    <td>
                      {row.breakEvenDays === null
                        ? "—"
                        : `${row.breakEvenDays} jours`}
                      <small>à {money(row.dailyRate)}/jour</small>
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        aria-label={`Financement ${row.name}`}
                        onClick={() => setEdit(row)}
                      >
                        <SlidersHorizontal size={15} /> Ajuster
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="profit-explanation">
            Le seuil correspond aux charges fixes divisées par le tarif
            journalier, arrondi au jour supérieur. Il suppose le plein tarif,
            sans frais variables ni remise. Une voiture archivée conserve son
            financement dans ce suivi.
          </p>
        </>
      )}
      {edit && (
        <FinanceEditor
          row={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function FinanceEditor({
  row,
  onClose,
  onSaved,
}: {
  row: ProfitRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FinanceProfile>(
    row.profile || {
      vehicleId: row.vehicleId,
      purchasePrice: 0,
      downPayment: 0,
      annualRate: 6.5,
      months: 60,
      startMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
      monthlyPaymentOverride: null,
      insurance: 0,
      maintenance: 0,
      otherCosts: 0,
      isEstimate: true,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const numericFields = [
    ["purchasePrice", "Prix d’achat (MAD)"],
    ["downPayment", "Apport (MAD)"],
    ["annualRate", "Taux annuel nominal (%)"],
    ["months", "Durée du crédit (mois)"],
    ["insurance", "Assurance / mois (MAD)"],
    ["maintenance", "Entretien / mois (MAD)"],
    ["otherCosts", "Autres charges / mois (MAD)"],
  ] as const;
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Financement · ${row.name}`}
      description="Ajustez les hypothèses ou renseignez les montants de votre contrat."
      wide
    >
      <form
        className="profit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/api/admin/profitability/${row.vehicleId}`, {
              method: "PUT",
              body: JSON.stringify(form),
            });
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {row.market && (
          <div className="profit-source">
            <strong>Référence marché : {money(row.market.price)}</strong>
            <p>
              {row.market.label} · consultation 19/11/2026. Prix d’appel neuf,
              hors frais éventuels ; ce n’est pas votre facture d’achat.
            </p>
            <a href={row.market.source} target="_blank" rel="noreferrer">
              Consulter la source <ArrowUpRight size={14} />
            </a>
          </div>
        )}
        <div className="profit-form-grid">
          {numericFields.map(([key, label]) => (
            <label key={key}>
              {label}
              <Input
                type="number"
                step={key === "months" ? "1" : "0.01"}
                min={key === "purchasePrice" || key === "months" ? 1 : 0}
                max={
                  key === "months" ? 120 : key === "annualRate" ? 40 : 10000000
                }
                required
                value={form[key]}
                onChange={(e) =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <label>
            Début des mensualités
            <Input
              type="month"
              required
              value={form.startMonth.slice(0, 7)}
              onChange={(e) =>
                setForm({ ...form, startMonth: e.target.value + "-01" })
              }
            />
          </label>
          <label>
            Mensualité du contrat (facultatif)
            <Input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              placeholder="Vide : calcul automatique"
              value={form.monthlyPaymentOverride ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthlyPaymentOverride:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <label className="profit-check">
          <input
            type="checkbox"
            checked={form.isEstimate}
            onChange={(e) => setForm({ ...form, isEstimate: e.target.checked })}
          />{" "}
          Ces montants sont des estimations
        </label>
        <p className="profit-explanation">
          La mensualité saisie remplace le calcul du crédit. Le taux et les
          budgets proposés sont des hypothèses, pas une offre bancaire. Les
          charges s’appliquent chaque mois, même après la fin du crédit.
        </p>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer le financement"}
        </Button>
      </form>
    </Modal>
  );
}
