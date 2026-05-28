import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "../ui/Text.js";
import { Icon } from "../ui/Icon.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import { haptics } from "../../utils/haptics.js";
import type { SymptomCode, SeverityLevel } from "@sweetcare/shared-types";

const SYMPTOM_META: Record<SymptomCode, { label: string; risk: SeverityLevel; icon: string }> = {
  hypoglycemia_mild: { label: "Hipoglicemia leve", risk: "moderate", icon: "alert-triangle" },
  tremor: { label: "Tremor", risk: "moderate", icon: "activity" },
  confusion: { label: "Confusão mental", risk: "severe", icon: "alert-octagon" },
  loss_of_consciousness: { label: "Perda de consciência", risk: "emergency", icon: "zap" },
  seizure: { label: "Convulsão", risk: "emergency", icon: "zap" },
  hyperglycemia: { label: "Hiperglicemia", risk: "moderate", icon: "trending-up" },
  ketoacidosis_risk: { label: "Risco de cetoacidose", risk: "severe", icon: "alert-octagon" },
  excessive_thirst: { label: "Sede excessiva", risk: "mild", icon: "droplet" },
  frequent_urination: { label: "Urinárias frequentes", risk: "mild", icon: "droplet" },
  fatigue: { label: "Fadiga", risk: "mild", icon: "battery" },
};

const ALL_CODES = Object.keys(SYMPTOM_META) as SymptomCode[];

interface SymptomCheckerProps {
  selectedCodes: SymptomCode[];
  onCodesChange: (codes: SymptomCode[]) => void;
  onSeverityPreview?: (severity: SeverityLevel) => void;
}

const SEVERITY_ORDER: SeverityLevel[] = ["mild", "moderate", "severe", "emergency"];

function computeSeverity(codes: SymptomCode[]): SeverityLevel {
  if (codes.length === 0) return "mild";
  return codes.reduce<SeverityLevel>((max, code) => {
    const risk = SYMPTOM_META[code].risk;
    return SEVERITY_ORDER.indexOf(risk) > SEVERITY_ORDER.indexOf(max) ? risk : max;
  }, "mild");
}

export function SymptomChecker({
  selectedCodes,
  onCodesChange,
  onSeverityPreview,
}: SymptomCheckerProps) {
  const { theme } = useTheme();

  const toggle = (code: SymptomCode) => {
    haptics.light();
    const next = selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code];
    onCodesChange(next);
    onSeverityPreview?.(computeSeverity(next));
  };

  return (
    <View style={styles.grid}>
      {ALL_CODES.map((code) => {
        const meta = SYMPTOM_META[code];
        const selected = selectedCodes.includes(code);
        const isEmergency = meta.risk === "emergency";
        const severityColors = theme.colors.severity[meta.risk];

        const chipBg = selected ? severityColors.surface : theme.colors.surface.DEFAULT;
        const chipBorder = selected
          ? severityColors.border
          : isEmergency
            ? theme.colors.error.border
            : theme.colors.border.DEFAULT;
        const textColor = selected ? severityColors.text : theme.colors.text.secondary;
        const iconColor = selected ? severityColors.icon : theme.colors.text.tertiary;

        return (
          <TouchableOpacity
            key={code}
            style={[
              styles.chip,
              {
                backgroundColor: chipBg,
                borderColor: chipBorder,
                borderWidth: isEmergency ? 1.5 : 1,
              },
              selected && theme.shadows.sm,
            ]}
            onPress={() => {
              toggle(code);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Sintoma: ${meta.label}. ${selected ? "Selecionado" : "Não selecionado"}`}
          >
            <Icon name={meta.icon} size="sm" color={iconColor} />
            <Text variant="bodySm" color={textColor} style={styles.chipLabel} numberOfLines={2}>
              {meta.label}
            </Text>
            {isEmergency && (
              <View
                style={[styles.emergencyDot, { backgroundColor: theme.colors.error.DEFAULT }]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    width: "47%",
    position: "relative",
  },
  chipLabel: { flex: 1, fontWeight: "500" },
  emergencyDot: { width: 6, height: 6, borderRadius: 3, position: "absolute", top: 6, right: 6 },
});
