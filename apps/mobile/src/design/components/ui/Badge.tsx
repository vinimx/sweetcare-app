import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "./Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { SyncStatus, SeverityLevel } from "@sweetcare/shared-types";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "severity" | "sync";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  severity?: SeverityLevel;
  syncStatus?: SyncStatus;
  size?: "sm" | "md";
}

export function Badge({
  label,
  variant = "default",
  severity,
  syncStatus,
  size = "sm",
}: BadgeProps) {
  const { theme } = useTheme();

  const getColors = () => {
    if (variant === "severity" && severity) {
      const s = theme.colors.severity[severity];
      return { bg: s.surface, text: s.text, border: s.border };
    }
    if (variant === "sync" && syncStatus) {
      const s = theme.colors.sync[syncStatus];
      return { bg: s.surface, text: s.color, border: s.surface };
    }
    const map: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
      default: {
        bg: theme.colors.surface.subtle,
        text: theme.colors.text.secondary,
        border: theme.colors.border.DEFAULT,
      },
      primary: {
        bg: theme.colors.primary.surface,
        text: theme.colors.primary.DEFAULT,
        border: theme.colors.primary.border,
      },
      success: {
        bg: theme.colors.success.surface,
        text: theme.colors.success.DEFAULT,
        border: theme.colors.success.border,
      },
      warning: {
        bg: theme.colors.warning.surface,
        text: theme.colors.warning.DEFAULT,
        border: theme.colors.warning.border,
      },
      error: {
        bg: theme.colors.error.surface,
        text: theme.colors.error.DEFAULT,
        border: theme.colors.error.border,
      },
      severity: {
        bg: theme.colors.surface.subtle,
        text: theme.colors.text.secondary,
        border: theme.colors.border.DEFAULT,
      },
      sync: {
        bg: theme.colors.surface.subtle,
        text: theme.colors.text.secondary,
        border: theme.colors.border.DEFAULT,
      },
    };
    return map[variant];
  };

  const c = getColors();
  const isEmergency = variant === "severity" && severity === "emergency";

  return (
    <View
      style={[
        styles.base,
        size === "md" && styles.md,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Text
        variant="caption"
        color={c.text}
        style={[styles.label, isEmergency && styles.emergencyText]}
      >
        {isEmergency ? label.toUpperCase() : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  label: { fontWeight: "600" },
  emergencyText: { fontWeight: "700", letterSpacing: 0.5 },
});
