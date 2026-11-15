import { Input } from "./components/ui/input";
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
    return "Utilisez une carte de test indiquée ci-dessous, jamais une vraie carte.";
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
    <fieldset
      className="form-stack"
      disabled={disabled}
      style={{
        border: "1px solid #DCE1D5",
        borderRadius: 14,
        padding: 18,
        marginBlock: 18,
      }}
    >
      <legend>Paiement par carte · MODE TEST</legend>
      <p>
        Le paiement test doit réussir avant l’envoi de la demande. Aucun débit
        réel. Ne saisissez jamais votre vraie carte.
      </p>
      <label>
        Nom du titulaire (test)
        <Input
          required
          autoComplete="off"
          value={value.cardholder}
          maxLength={100}
          placeholder="Client Test"
          onChange={(e) => onChange({ ...value, cardholder: e.target.value })}
        />
      </label>
      <label>
        Numéro de carte test
        <Input
          required
          autoComplete="off"
          inputMode="numeric"
          value={value.number}
          maxLength={19}
          placeholder="4242 4242 4242 4242"
          onChange={(e) =>
            onChange({
              ...value,
              number: e.target.value
                .replace(/\D/g, "")
                .slice(0, 16)
                .replace(/(.{4})(?=.)/g, "$1 "),
            })
          }
        />
      </label>
      <div className="form-grid">
        <label>
          Expiration (MM/AA)
          <Input
            required
            autoComplete="off"
            inputMode="numeric"
            value={value.expiry}
            maxLength={5}
            placeholder="12/30"
            onChange={(e) =>
              onChange({
                ...value,
                expiry: e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
                  .replace(/^(\d{2})(\d)/, "$1/$2"),
              })
            }
          />
        </label>
        <label>
          CVC test
          <Input
            required
            type="password"
            autoComplete="off"
            inputMode="numeric"
            value={value.cvc}
            maxLength={3}
            placeholder="123"
            onChange={(e) =>
              onChange({
                ...value,
                cvc: e.target.value.replace(/\D/g, "").slice(0, 3),
              })
            }
          />
        </label>
      </div>
      <small>
        Acceptée : 4242 4242 4242 4242 · Refusée : 4000 0000 0000 0002.
        Expiration future, CVC 123. Aucun numéro ou CVC n’est enregistré.
      </small>
    </fieldset>
  );
}
