import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "../ui/Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";

interface GlucoseIndicatorProps {
  valueMgdl: number | null;
  targetMin: number;
  targetMax: number;
  recordedAt?: string;
  size?: "sm" | "md" | "lg";
  variant?: "circle" | "inline" | "banner";
}

function getGlucoseState(v: number, min: number, max: number) {
  if (v < 54) return { key: "critical", label: "CRÍTICO", sublabel: "Hipoglicemia grave" };
  if (v < 70) return { key: "low", label: "BAIXO", sublabel: "Hipoglicemia" };
  if (v < min) return { key: "low", label: "ABAIXO", sublabel: "Abaixo do alvo" };
  if (v <= max) return { key: "normal", label: "NORMAL", sublabel: "No alvo" };
  if (v <= 250) return { key: "high", label: "ALTO", sublabel: "Acima do alvo" };
  return { key: "critical", label: "CRÍTICO", sublabel: "Hiperglicemia" };
}

function isStaleness(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 3 * 60 * 60 * 1000;
}

export function GlucoseIndicator({
  valueMgdl,
  targetMin,
  targetMax,
  recordedAt,
  size = "md",
  variant = "circle",
}: GlucoseIndicatorProps) {
  const { theme } = useTheme();

  if (valueMgdl == null) {
    if (variant === "inline")
      return (
        <Text variant="bodySm" color={theme.colors.text.tertiary}>
          — mg/dL
        </Text>
      );
    return null;
  }

  const state = getGlucoseState(valueMgdl, targetMin, targetMax);
  const glucoseColors = theme.colors.glucose;
  const colorMap: Record<string, { color: string; surface: string; border: string }> = {
    critical: {
      color: glucoseColors.critical,
      surface: glucoseColors.criticalSurface,
      border: glucoseColors.criticalBorder,
    },
    low: {
      color: glucoseColors.low,
      surface: glucoseColors.lowSurface,
      border: glucoseColors.lowBorder,
    },
    normal: {
      color: glucoseColors.normal,
      surface: glucoseColors.normalSurface,
      border: glucoseColors.normalBorder,
    },
    high: {
      color: glucoseColors.high,
      surface: glucoseColors.highSurface,
      border: glucoseColors.highBorder,
    },
  };
  const c = colorMap[state.key] ?? {
    color: glucoseColors.normal,
    surface: glucoseColors.normalSurface,
    border: glucoseColors.normalBorder,
  };
  const stale = recordedAt ? isStaleness(recordedAt) : false;

  if (variant === "banner") {
    return (
      <View
        style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}
        accessibilityRole="alert"
        accessibilityLabel={`Glicemia: ${String(valueMgdl)} mg/dL. ${state.sublabel}`}
      >
        <Text variant="label" color={c.color}>
          {state.label}
        </Text>
        <Text variant="numeric" color={c.color} style={styles.bannerValue}>
          {String(valueMgdl)}
        </Text>
        <Text variant="unit" color={c.color}>
          {" "}
          mg/dL
        </Text>
        {stale && (
          <Text variant="caption" color={theme.colors.warning.DEFAULT} style={styles.staleText}>
            · desatualizado
          </Text>
        )}
      </View>
    );
  }

  if (variant === "inline") {
    return (
      <View style={styles.inlineRow}>
        <Text variant="numeric" color={c.color}>
          {String(valueMgdl)}
        </Text>
        <Text variant="unit" color={theme.colors.text.secondary}>
          {" "}
          mg/dL
        </Text>
        {stale && (
          <Text variant="caption" color={theme.colors.warning.DEFAULT}>
            {" "}
            · ⚠
          </Text>
        )}
      </View>
    );
  }

  const circleSize = size === "sm" ? 80 : size === "lg" ? 140 : 110;
  return (
    <View
      style={[
        styles.circle,
        {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: c.surface,
          borderColor: c.color,
        },
      ]}
      accessibilityLabel={`Glicemia: ${String(valueMgdl)} mg/dL. ${state.sublabel}`}
    >
      <Text variant={size === "sm" ? "numeric" : "numericLg"} color={c.color}>
        {String(valueMgdl)}
      </Text>
      <Text variant="caption" color={theme.colors.text.secondary}>
        mg/dL
      </Text>
      <Text variant="caption" color={c.color} style={styles.stateLabel}>
        {state.label}
      </Text>
      {stale && (
        <Text variant="caption" color={theme.colors.warning.DEFAULT}>
          ⚠
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", borderWidth: 2.5, gap: 1 },
  stateLabel: { fontWeight: "700", letterSpacing: 0.5 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  bannerValue: {},
  staleText: { marginLeft: 4 },
  inlineRow: { flexDirection: "row", alignItems: "baseline" },
});
