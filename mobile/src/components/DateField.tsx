import { Field } from "./ui";
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimum?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      placeholder="AAAA-MM-JJ"
      onChangeText={onChange}
      autoCapitalize="none"
      maxLength={10}
    />
  );
}
