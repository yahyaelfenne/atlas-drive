import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { dateLabel } from "../lib/types";
import { colors, Icon, styles } from "./ui";
export function DateField({
  label,
  value,
  onChange,
  minimum,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimum?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontWeight: "600", color: colors.ink }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${dateLabel(value)}`}
        style={[styles.input, styles.between]}
        onPress={() => setOpen(!open)}
      >
        <Text style={{ color: colors.ink }}>{dateLabel(value)}</Text>
        <Icon name="calendar-outline" size={19} />
      </Pressable>
      {open && (
        <DateTimePicker
          value={new Date(`${value}T12:00:00`)}
          minimumDate={minimum ? new Date(`${minimum}T00:00:00`) : undefined}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selected) => {
            setOpen(Platform.OS === "ios");
            if (selected)
              onChange(
                `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`,
              );
          }}
        />
      )}
    </View>
  );
}
