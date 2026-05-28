import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "./Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  color?: string;
  thickness?: number;
  spacing?: number;
  label?: string;
}

export function Divider({
  orientation = "horizontal",
  color,
  thickness,
  spacing = 8,
  label,
}: DividerProps) {
  const { theme } = useTheme();
  const lineColor = color ?? theme.colors.border.DEFAULT;
  const lineThickness = thickness ?? StyleSheet.hairlineWidth;

  if (label) {
    return (
      <View style={[styles.labelRow, { marginVertical: spacing }]}>
        <View
          style={[styles.line, { backgroundColor: lineColor, height: lineThickness, flex: 1 }]}
        />
        <Text variant="caption" color={theme.colors.text.tertiary} style={styles.labelText}>
          {label}
        </Text>
        <View
          style={[styles.line, { backgroundColor: lineColor, height: lineThickness, flex: 1 }]}
        />
      </View>
    );
  }

  if (orientation === "vertical") {
    return (
      <View
        style={[{ width: lineThickness, backgroundColor: lineColor, marginHorizontal: spacing }]}
      />
    );
  }

  return (
    <View
      style={[{ height: lineThickness, backgroundColor: lineColor, marginVertical: spacing }]}
    />
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center" },
  line: {},
  labelText: { marginHorizontal: 10 },
});
