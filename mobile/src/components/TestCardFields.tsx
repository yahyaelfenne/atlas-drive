import { Text, View } from "react-native";
import { Field, styles } from "./ui";
export interface TestCard {
  cardholder: string;
  number: string;
  expiry: string;
  cvc: string;
}
export const emptyCard: TestCard = {
  cardholder: "",
  number: "",
  expiry: "",
  cvc: "",
};
export function cardError(card: TestCard): string {
  if (card.cardholder.trim().length < 2)
    return "Indiquez le nom du titulaire de la carte test.";
  if (
    !["4242424242424242", "4000000000000002"].includes(
      card.number.replace(/[\s-]/g, ""),
    )
  )
    return "Utilisez uniquement les cartes de test indiquées. Jamais de vraie carte.";
  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(card.expiry))
    return "Indiquez une expiration de test au format MM/AA.";
  if (!/^[0-9]{3}$/.test(card.cvc))
    return "Indiquez un CVC de test à 3 chiffres.";
  return "";
}
export function TestCardFields({
  value,
  onChange,
  disabled,
}: {
  value: TestCard;
  onChange: (card: TestCard) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>PAIEMENT PAR CARTE · MODE TEST</Text>
      <Text style={styles.body}>
        Le paiement test précède l’envoi de la demande. Aucun débit réel. Ne
        saisissez jamais une vraie carte.
      </Text>
      <Field
        label="Nom du titulaire (test)"
        value={value.cardholder}
        onChangeText={(cardholder) => onChange({ ...value, cardholder })}
        placeholder="Client Test"
        editable={!disabled}
        maxLength={100}
        autoComplete="off"
        autoCorrect={false}
      />
      <Field
        label="Numéro de carte test"
        value={value.number}
        onChangeText={(number) =>
          onChange({
            ...value,
            number: number
              .replace(/\D/g, "")
              .slice(0, 16)
              .replace(/(.{4})(?=.)/g, "$1 "),
          })
        }
        placeholder="4242 4242 4242 4242"
        editable={!disabled}
        maxLength={19}
        keyboardType="number-pad"
        autoComplete="off"
      />
      <Field
        label="Expiration (MM/AA)"
        value={value.expiry}
        onChangeText={(expiry) =>
          onChange({
            ...value,
            expiry: expiry
              .replace(/\D/g, "")
              .slice(0, 4)
              .replace(/^(\d{2})(\d)/, "$1/$2"),
          })
        }
        placeholder="12/30"
        editable={!disabled}
        maxLength={5}
        keyboardType="number-pad"
        autoComplete="off"
      />
      <Field
        label="CVC test"
        value={value.cvc}
        onChangeText={(cvc) =>
          onChange({ ...value, cvc: cvc.replace(/\D/g, "").slice(0, 3) })
        }
        placeholder="123"
        editable={!disabled}
        maxLength={3}
        keyboardType="number-pad"
        autoComplete="off"
        secureTextEntry
      />
      <Text style={styles.small}>
        Acceptée : 4242 4242 4242 4242{"\n"}Refusée : 4000 0000 0000 0002{"\n"}
        Expiration future, CVC 123. Aucun numéro ou CVC n’est enregistré.
      </Text>
    </View>
  );
}
