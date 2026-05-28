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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = today.getDate() - d.getDate();
  if (diff === 0 && today.getMonth() === d.getMonth()) return "Hoje";
  if (diff === 1 && today.getMonth() === d.getMonth()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function glucoseColor(v: number, theme: ReturnType<typeof useTheme>["theme"]): string {
  const c = theme.colors.glucose;
  if (v < 70) return c.low;
  if (v <= 180) return c.normal;
  if (v <= 250) return c.high;
  return c.critical;
}

interface DoseCardProps {
  record: InsulinApplicationRecord;
  onPress?: () => void;
  compact?: boolean;
}

export function DoseCard({ record, onPress, compact = false }: DoseCardProps) {
  const { theme } = useTheme();

  const glColor =
    record.glucoseBeforeMgdl != null
      ? glucoseColor(record.glucoseBeforeMgdl, theme)
      : theme.colors.text.tertiary;

  return (
    <Card
      variant="default"
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`Insulina ${record.insulinType}, ${String(record.doseUnits)} U, ${RATIONALE_LABELS[record.doseRationale] ?? record.doseRationale}`}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary.surface }]}>
          <Icon
            name="syringe"
            family="MaterialCommunityIcons"
            size="md"
            color={theme.colors.primary.DEFAULT}
          />
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text variant="h4" numberOfLines={1} style={styles.flex}>
              {record.insulinType}
            </Text>
            <Badge
              variant="sync"
              syncStatus={record.syncStatus}
              label={
                record.syncStatus === "pending"
                  ? "Pendente"
                  : record.syncStatus === "conflict"
                    ? "Conflito"
                    : "✓"
              }
            />
          </View>
          <View style={styles.detailRow}>
            <Text variant="numeric" color={theme.colors.primary.dark}>
              {record.doseUnits.toFixed(2)}
            </Text>
            <Text variant="unit" color={theme.colors.text.secondary}>
              {" "}
              U
            </Text>
            <Text variant="bodySm" color={theme.colors.text.tertiary}>
              {" "}
              · {RATIONALE_LABELS[record.doseRationale] ?? record.doseRationale}
            </Text>
            {record.mealCarbsGrams != null && (
              <Text variant="bodySm" color={theme.colors.text.tertiary}>
                {" "}
                · {record.mealCarbsGrams}g
              </Text>
            )}
          </View>
          {!compact && record.glucoseBeforeMgdl != null && (
            <View style={styles.glucoseRow}>
              <Icon name="droplet" size="xs" color={glColor} />
              <Text variant="bodySm" color={glColor} style={styles.glucoseText}>
                {record.glucoseBeforeMgdl} mg/dL antes
              </Text>
            </View>
          )}
        </View>
        <View style={styles.timeCol}>
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {formatDate(record.appliedAt)}
          </Text>
          <Text variant="caption" color={theme.colors.text.secondary}>
            {formatTime(record.appliedAt)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  info: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  flex: { flex: 1 },
  detailRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  glucoseRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  glucoseText: {},
  timeCol: { alignItems: "flex-end", gap: 2, minWidth: 52 },
});
