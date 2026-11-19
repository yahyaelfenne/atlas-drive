import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Image, Text, View } from "react-native";
import { useApp } from "../lib/session";
import { money } from "../lib/types";
import type {
  FinanceProfile,
  ProfitReport,
  ProfitRow,
} from "../lib/profitability-types";
import { Button, Chips, ErrorMessage, Field, styles } from "./ui";

export function Profitability() {
  const { api } = useApp();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [includeTest, setIncludeTest] = useState("yes");
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [edit, setEdit] = useState<ProfitRow | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<ProfitReport>(
        `/api/admin/profitability?month=${month}&includeTest=${includeTest === "yes"}`,
      );
      if (id === sequence.current) setReport(data);
    } catch (e) {
      if (id === sequence.current) {
        setError((e as Error).message);
        setReport(null);
      }
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }, [api, month, includeTest]);
  useFocusEffect(
    useCallback(() => {
      if (/^\d{4}-\d{2}$/.test(month)) void load();
      return () => {
        sequence.current++;
      };
    }, [load, month]),
  );
  if (edit)
    return (
      <FinanceEditor
        row={edit}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          void load();
        }}
      />
    );
  return (
    <View style={{ gap: 18 }}>
      <Text style={styles.heading}>Rentabilité par voiture</Text>
      <View style={[styles.card, { backgroundColor: "#EDF3E2" }]}>
        <Text style={styles.heading}>Une simulation modifiable</Text>
        <Text style={styles.small}>
          Prix neufs indicatifs au Maroc, consultés le 19/11/2026. Hypothèses :
          apport 20 %, crédit 60 mois à 6,5 % annuel, début novembre 2026.
          Assurance et entretien : budgets estimés sans devis. Finition et année
          à confirmer.
        </Text>
      </View>
      <Field
        label="Mois étudié (AAAA-MM)"
        value={month}
        onChangeText={(value) => {
          sequence.current++;
          setReport(null);
          setMonth(value);
        }}
        maxLength={7}
      />
      <Chips
        value={includeTest}
        onChange={setIncludeTest}
        options={[
          { label: "Simulation avec paiements test", value: "yes" },
          { label: "Encaissements réels", value: "no" },
        ]}
      />
      <Button
        title="Actualiser la rentabilité"
        secondary
        busy={busy}
        disabled={!/^\d{4}-\d{2}$/.test(month)}
        onPress={load}
      />
      <ErrorMessage message={error} />
      {report && (
        <>
          <View style={[styles.card, { backgroundColor: "#173E31" }]}>
            <Text style={{ color: "#D4EE94", fontSize: 13 }}>
              SOLDE APRÈS CRÉDIT ET CHARGES
            </Text>
            <Text style={[styles.title, { color: "white" }]}>
              {money(report.summary.balance)}
            </Text>
            <Text style={{ color: "#DCE1D5", fontSize: 12 }}>
              {report.summary.configured}/{report.summary.total} voitures
              renseignées ·{" "}
              {includeTest === "yes"
                ? "paiements test inclus"
                : "paiements réels uniquement"}
            </Text>
          </View>
          <View style={styles.card}>
            {[
              ["Revenus retenus", report.summary.revenue],
              ["Mensualités de crédit", report.summary.credit],
              ["Charges budgétées", report.summary.costs],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.between}>
                <Text style={styles.body}>{label}</Text>
                <Text style={{ fontWeight: "700" }}>
                  {money(Number(value))}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.small}>
            Solde de trésorerie = revenus − crédit − charges. Hors apport
            initial, impôts, amortissement et frais exceptionnels. Seules les
            locations acceptées et payées comptent, au mois de création du
            paiement. Les coûts inconnus restent à renseigner.
          </Text>
          {report.rows.map((row) => (
            <View key={row.vehicleId} style={styles.card}>
              <View style={styles.row}>
                <Image
                  source={{ uri: row.imageUrl }}
                  style={{ width: 80, height: 55, borderRadius: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heading}>{row.name}</Text>
                  <Text style={styles.small}>
                    {row.archived ? "Archivée · " : ""}
                    {row.profile
                      ? row.profile.isEstimate
                        ? "Montants estimés"
                        : "Montants renseignés"
                      : "À renseigner"}
                  </Text>
                </View>
              </View>
              {[
                ["Revenus", row.revenue],
                ["dont paiements réels", row.realRevenue],
                ["dont paiements test", row.testRevenue],
                ["Crédit / mois", row.credit],
                ["Charges / mois", row.costs],
                ["Solde du mois", row.balance],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.between}>
                  <Text style={styles.body}>{label}</Text>
                  <Text
                    style={{
                      fontWeight: "700",
                      color:
                        label === "Solde du mois" && Number(value) < 0
                          ? "#A45B35"
                          : "#173E31",
                    }}
                  >
                    {value === null ? "À renseigner" : money(Number(value))}
                  </Text>
                </View>
              ))}
              <Text style={styles.small}>
                Seuil indicatif :{" "}
                {row.breakEvenDays === null
                  ? "à renseigner"
                  : `${row.breakEvenDays} jours à ${money(row.dailyRate)}/jour`}
                . Sans remise ni frais variables.
              </Text>
              <Button
                secondary
                title={`Ajuster ${row.name}`}
                onPress={() => setEdit(row)}
              />
            </View>
          ))}
        </>
      )}
    </View>
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
  const { api } = useApp();
  const initial: FinanceProfile = row.profile || {
    vehicleId: row.vehicleId,
    purchasePrice: 0,
    downPayment: 0,
    annualRate: 6.5,
    months: 60,
    startMonth: new Date().toISOString().slice(0, 7) + "-01",
    insurance: 0,
    maintenance: 0,
    otherCosts: 0,
    monthlyPaymentOverride: null,
    isEstimate: true,
  };
  const [values, setValues] = useState(
    Object.fromEntries(
      Object.entries(initial).map(([key, value]) => [
        key,
        value === null ? "" : String(value),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = [
    ["purchasePrice", "Prix d’achat (MAD)"],
    ["downPayment", "Apport (MAD)"],
    ["annualRate", "Taux annuel nominal (%)"],
    ["months", "Durée du crédit (mois)"],
    ["insurance", "Assurance / mois (MAD)"],
    ["maintenance", "Entretien / mois (MAD)"],
    ["otherCosts", "Autres charges / mois (MAD)"],
    ["monthlyPaymentOverride", "Mensualité du contrat (facultatif)"],
  ] as const;
  async function save() {
    setError("");
    const payload = {
      ...initial,
      startMonth: values.startMonth,
      isEstimate: values.isEstimate === "true",
    };
    for (const [key] of fields) {
      if (key !== "monthlyPaymentOverride" && !values[key].trim()) {
        setError("Complétez tous les montants obligatoires.");
        return;
      }
      const n = Number(values[key].replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setError("Vérifiez les montants.");
        return;
      }
      if (key === "monthlyPaymentOverride")
        payload.monthlyPaymentOverride = !values[key].trim() ? null : n;
      else payload[key] = n;
    }
    if (!/^\d{4}-\d{2}-01$/.test(payload.startMonth)) {
      setError("Indiquez le début au format AAAA-MM.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/profitability/${row.vehicleId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 18 }}>
      <Button secondary title="Retour à la rentabilité" onPress={onClose} />
      <Text style={styles.heading}>Financement · {row.name}</Text>
      {row.market && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Référence marché : {money(row.market.price)}
          </Text>
          <Text style={styles.small}>
            {row.market.label} · consultation 19/11/2026. Prix indicatif neuf,
            hors frais éventuels ; ce n’est pas votre facture.
          </Text>
          <Text selectable style={styles.small}>
            {row.market.source}
          </Text>
        </View>
      )}
      {fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          keyboardType="decimal-pad"
          onChangeText={(value) => setValues({ ...values, [key]: value })}
        />
      ))}
      <Field
        label="Début des mensualités (AAAA-MM)"
        value={values.startMonth.slice(0, 7)}
        maxLength={7}
        onChangeText={(value) =>
          setValues({ ...values, startMonth: value + "-01" })
        }
      />
      <Chips
        value={values.isEstimate}
        onChange={(value) => setValues({ ...values, isEstimate: value })}
        options={[
          { label: "Montants estimés", value: "true" },
          { label: "Montants réels renseignés", value: "false" },
        ]}
      />
      <Text style={styles.small}>
        Laissez la mensualité vide pour le calcul automatique. Le taux proposé
        est une hypothèse, pas une offre bancaire. Les charges restent
        applicables après la fin du crédit.
      </Text>
      <ErrorMessage message={error} />
      <Button title="Enregistrer le financement" busy={busy} onPress={save} />
    </View>
  );
}
