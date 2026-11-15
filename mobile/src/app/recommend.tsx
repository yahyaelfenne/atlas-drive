import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useApp } from "../lib/session";
import { categories, type Vehicle } from "../lib/types";
import { Button, Chips, ErrorMessage, Field, styles } from "../components/ui";
import { VehicleCard } from "../components/VehicleCard";
export default function Recommend() {
  const { api } = useApp();
  const [budget, setBudget] = useState("700");
  const [passengers, setPassengers] = useState("4");
  const [category, setCategory] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function recommend() {
    setError("");
    setBusy(true);
    setVehicles([]);
    setExplanation("");
    try {
      const [selection, fleet] = await Promise.all([
        api<{ vehicleIds: number[]; explanation: string }>(
          "/api/recommendations",
          {
            method: "POST",
            body: JSON.stringify({
              budget: Number(budget),
              passengers: Number(passengers),
              category: category || null,
            }),
          },
        ),
        api<Vehicle[]>("/api/vehicles"),
      ]);
      setVehicles(
        selection.vehicleIds
          .map((id) => fleet.find((car) => car.id === id))
          .filter((car): car is Vehicle => Boolean(car)),
      );
      setExplanation(selection.explanation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>Votre compagnon{"\n"}de route.</Text>
        <Text style={styles.body}>
          Quelques préférences suffisent pour vous orienter.
        </Text>
        <Field
          label="Budget par jour (MAD)"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Nombre de voyageurs</Text>
        <Chips
          value={passengers}
          onChange={setPassengers}
          options={Array.from({ length: 9 }, (_, index) => ({
            label: String(index + 1),
            value: String(index + 1),
          }))}
        />
        <Text style={styles.label}>Une préférence ?</Text>
        <Chips
          value={category}
          onChange={setCategory}
          options={[
            { label: "Surprenez-moi", value: "" },
            ...categories.map((value) => ({ label: value, value })),
          ]}
        />
        <Button
          title="Voir mes recommandations"
          busy={busy}
          disabled={
            !Number.isFinite(Number(budget)) ||
            Number(budget) < 50 ||
            Number(budget) > 100000
          }
          onPress={recommend}
        />
        <ErrorMessage message={error} />
        {Boolean(explanation) && (
          <View style={styles.card}>
            <Text style={styles.body}>{explanation}</Text>
          </View>
        )}
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </View>
    </ScrollView>
  );
}
