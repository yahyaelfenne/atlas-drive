import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export const colors = {
  background: "#F8F8F2",
  ink: "#173E31",
  lime: "#D4EE94",
  muted: "#737C72",
  border: "#DCE1D5",
  white: "#FFFFFF",
  danger: "#A73535",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 22,
    paddingBottom: 36,
    gap: 18,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -1,
  },
  heading: { fontSize: 21, fontWeight: "700", color: colors.ink },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.muted,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.white,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
    minHeight: 50,
  },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} style={{ color }} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: secondary
          ? colors.lime
          : danger
            ? colors.danger
            : colors.ink,
        padding: 16,
        minHeight: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || busy ? 0.45 : pressed ? 0.8 : 1,
        flexDirection: "row",
        gap: 10,
      })}
    >
      {busy && (
        <ActivityIndicator color={secondary ? colors.ink : colors.white} />
      )}
      <Text
        style={{
          color: secondary ? colors.ink : colors.white,
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 14 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 3 }}
    >
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          key={option.value}
          onPress={() => onChange(option.value)}
          style={{
            paddingHorizontal: 15,
            paddingVertical: 11,
            borderRadius: 30,
            borderWidth: 1,
            borderColor: value === option.value ? colors.ink : colors.border,
            backgroundColor: value === option.value ? colors.ink : colors.white,
          }}
        >
          <Text
            style={{
              color: value === option.value ? colors.white : colors.ink,
              fontWeight: "600",
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function ErrorMessage({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.card, { borderColor: "#E4BCB5" }]}
    >
      <Text style={styles.error}>{message}</Text>
      {retry && <Button secondary title="Réessayer" onPress={retry} />}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: "center", gap: 14 }}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.body}>Chargement…</Text>
    </View>
  );
}
export function DemoNote() {
  return (
    <Text style={[styles.small, { textAlign: "center", paddingTop: 12 }]}>
      Version de démonstration · véhicules et agences fictifs · photos
      illustratives.
    </Text>
  );
}
