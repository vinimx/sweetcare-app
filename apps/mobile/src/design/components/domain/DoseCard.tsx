import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "../ui/Card.js";
import { Text } from "../ui/Text.js";
import { Badge } from "../ui/Badge.js";
import { Icon } from "../ui/Icon.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { InsulinApplicationRecord } from "@sweetcare/shared-types";

const RATIONALE_LABELS: Record<string, string> = {
  correction: "Correção",
  meal_coverage: "Refeição",
  basal: "Basal",
  combination: "Combinada",
};

/** Left accent bar color signals dose intent at a glance */
const ACCENT_COLORS: Record<string, string> = {
  meal_coverage: "#16A34A", // green — fed
  correction: "#D97706", // amber — corrective
  basal: "#2563EB", // blue — routine
  combination: "#7C3AED", // violet — complex
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function glucoseColor(v: number, theme: ReturnType<typeof useTheme>["theme"]): string {
  const g = theme.colors.glucose;
  if (v < 54) return g.critical;
  if (v < 70) return g.low;
  if (v <= 180) return g.normal;
  if (v <= 250) return g.high;
  return g.critical;
}

interface DoseCardProps {
  record: InsulinApplicationRecord;
  onPress?: () => void;
  compact?: boolean;
}

export function DoseCard({ record, onPress, compact = false }: DoseCardProps) {
  const { theme } = useTheme();

  const accentColor = ACCENT_COLORS[record.doseRationale] ?? theme.colors.primary.DEFAULT;
  const glColor =
    record.glucoseBeforeMgdl != null ? glucoseColor(record.glucoseBeforeMgdl, theme) : null;

  const syncLabel =
    record.syncStatus === "pending"
      ? "Pendente"
      : record.syncStatus === "conflict"
        ? "Conflito"
        : "Sync";

  return (
    <Card
      variant="default"
      onPress={onPress}
      style={styles.card}
      accentColor={accentColor}
      accessibilityLabel={`Insulina ${record.insulinType}, ${String(record.doseUnits)} U, ${RATIONALE_LABELS[record.doseRationale] ?? record.doseRationale}`}
    >
      {/* Top row: icon + name/rationale + time + sync */}
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: `${accentColor}18` }]}>
          <Icon name="syringe" family="MaterialCommunityIcons" size="md" color={accentColor} />
        </View>

        <View style={styles.nameBlock}>
          <Text
            variant="label"
            numberOfLines={1}
            style={[styles.insulinName, { color: theme.colors.text.primary }]}
          >
            {record.insulinType}
          </Text>
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {RATIONALE_LABELS[record.doseRationale] ?? record.doseRationale}
          </Text>
        </View>

        <View style={styles.rightBlock}>
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {formatTime(record.appliedAt)}
          </Text>
          <Badge variant="sync" syncStatus={record.syncStatus} label={syncLabel} size="sm" />
        </View>
      </View>

      {/* Bottom row: dose value + glucose chip */}
      <View style={styles.bottomRow}>
        <View style={styles.doseBlock}>
          <Text variant="numeric" color={theme.colors.text.primary}>
            {record.doseUnits.toFixed(2)}
          </Text>
          <Text variant="unit" color={theme.colors.text.secondary}>
            {" "}
            U
          </Text>
          {record.mealCarbsGrams != null && (
            <Text variant="bodySm" color={theme.colors.text.tertiary}>
              {" · "}
              {record.mealCarbsGrams}g carbs
            </Text>
          )}
        </View>

        {!compact && glColor != null && record.glucoseBeforeMgdl != null && (
          <View
            style={[
              styles.glucoseChip,
              {
                backgroundColor: `${glColor}14`,
                borderColor: `${glColor}28`,
              },
            ]}
          >
            <Icon name="droplet" size="xs" color={glColor} />
            <Text variant="caption" color={glColor} style={styles.glucoseVal}>
              {" "}
              {record.glucoseBeforeMgdl} mg/dL
            </Text>
          </View>
        )}
      </View>

      {!compact && record.notes != null && record.notes.length > 0 && (
        <Text
          variant="caption"
          color={theme.colors.text.tertiary}
          numberOfLines={1}
          style={styles.notes}
        >
          {record.notes}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nameBlock: { flex: 1, justifyContent: "center", gap: 2 },
  insulinName: { fontWeight: "600", fontSize: 15 },
  rightBlock: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  doseBlock: { flexDirection: "row", alignItems: "baseline" },
  glucoseChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  glucoseVal: { fontWeight: "600" },
  notes: { marginTop: 6 },
});
