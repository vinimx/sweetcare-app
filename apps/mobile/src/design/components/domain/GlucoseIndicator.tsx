import React, { useRef, useEffect } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Text } from "../ui/Text.js";
import { Icon } from "../ui/Icon.js";
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
  if (v < 54)
    return { key: "critical", label: "CRÍTICO", sublabel: "Hipoglicemia grave", urgent: true };
  if (v < 70) return { key: "low", label: "BAIXO", sublabel: "Hipoglicemia", urgent: true };
  if (v < min) return { key: "low", label: "ABAIXO", sublabel: "Abaixo do alvo", urgent: true };
  if (v <= max) return { key: "normal", label: "NORMAL", sublabel: "No alvo", urgent: false };
  if (v <= 250) return { key: "high", label: "ALTO", sublabel: "Acima do alvo", urgent: false };
  return { key: "critical", label: "CRÍTICO", sublabel: "Hiperglicemia grave", urgent: true };
}

function isStale(iso: string): boolean {
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const state = valueMgdl != null ? getGlucoseState(valueMgdl, targetMin, targetMax) : null;
  const stateUrgent = state?.urgent ?? false;

  useEffect(() => {
    if (!stateUrgent || variant !== "circle") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.045, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [stateUrgent, variant, pulseAnim]);

  if (valueMgdl == null) {
    if (variant === "inline") {
      return (
        <Text variant="bodySm" color={theme.colors.text.tertiary}>
          — mg/dL
        </Text>
      );
    }
    return null;
  }

  const glucoseColors = theme.colors.glucose;
  const COLOR_MAP: Record<string, { color: string; surface: string; border: string }> = {
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

  const fallbackColors = {
    color: glucoseColors.normal,
    surface: glucoseColors.normalSurface,
    border: glucoseColors.normalBorder,
  };
  const c = COLOR_MAP[state?.key ?? "normal"] ?? fallbackColors;
  const staleFlag = recordedAt ? isStale(recordedAt) : false;

  /* ── Banner variant ─────────────────────────────── */
  if (variant === "banner") {
    return (
      <View
        style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}
        accessibilityRole="alert"
        accessibilityLabel={`Glicemia: ${String(valueMgdl)} mg/dL. ${state?.sublabel ?? ""}`}
      >
        <View style={[styles.bannerDot, { backgroundColor: c.color }]} />
        <Text variant="label" color={c.color} style={styles.bannerLabel}>
          {state?.label ?? ""}
        </Text>
        <Text variant="numeric" color={c.color}>
          {String(valueMgdl)}
        </Text>
        <Text variant="unit" color={c.color}>
          {" "}
          mg/dL
        </Text>
        {staleFlag && (
          <Icon
            name="clock"
            size="xs"
            color={theme.colors.warning.DEFAULT}
            accessibilityLabel="Dado desatualizado"
          />
        )}
      </View>
    );
  }

  /* ── Inline variant ─────────────────────────────── */
  if (variant === "inline") {
    return (
      <View style={styles.inlineRow}>
        <View style={[styles.inlineDot, { backgroundColor: c.color }]} />
        <Text variant="numeric" color={c.color}>
          {String(valueMgdl)}
        </Text>
        <Text variant="unit" color={theme.colors.text.secondary}>
          {" "}
          mg/dL
        </Text>
        {staleFlag && (
          <Text variant="caption" color={theme.colors.warning.DEFAULT}>
            {" "}
            ⚠
          </Text>
        )}
      </View>
    );
  }

  /* ── Circle variant — primary display ──────────── */
  const outerSize = size === "sm" ? 92 : size === "lg" ? 148 : 120;
  const innerSize = outerSize - 12; // 6px inset on each side

  return (
    // Extra space around circle so pulse scale doesn't get clipped
    <View
      style={{
        width: outerSize + 16,
        height: outerSize + 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{ transform: [{ scale: pulseAnim }] }}
        accessibilityLabel={`Glicemia: ${String(valueMgdl)} mg/dL. ${state?.sublabel ?? ""}`}
        accessibilityRole="text"
      >
        {/* Outer ring */}
        <View
          style={[
            styles.outerRing,
            {
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
              borderColor: c.color,
              borderWidth: 3.5,
              padding: 4,
            },
          ]}
        >
          {/* Inner circle */}
          <View
            style={[
              styles.innerCircle,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                backgroundColor: c.surface,
              },
            ]}
          >
            <Text
              variant={size === "sm" ? "numeric" : "numericLg"}
              color={c.color}
              style={styles.valueText}
            >
              {String(valueMgdl)}
            </Text>

            <Text variant="caption" color={theme.colors.text.secondary} style={styles.unitText}>
              mg/dL
            </Text>

            {/* State chip */}
            <View style={[styles.stateChip, { backgroundColor: `${c.color}1A` }]}>
              <Text style={[styles.stateLabel, { color: c.color }]}>{state?.label ?? ""}</Text>
            </View>

            {staleFlag && (
              <View style={styles.staleRow}>
                <Icon name="clock" size="xs" color={theme.colors.warning.DEFAULT} />
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  valueText: { includeFontPadding: false },
  unitText: { marginTop: -2 },
  stateChip: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  stateLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  staleRow: { marginTop: 2 },
  /* Banner */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerLabel: { fontWeight: "700", marginRight: 2 },
  /* Inline */
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  inlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
