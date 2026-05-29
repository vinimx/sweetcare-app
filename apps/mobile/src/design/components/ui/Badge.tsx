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

const SYNC_DOTS: Record<SyncStatus, string> = {
  pending: "●",
  synced: "✓",
  conflict: "⚠",
};

export function Badge({
  label,
  variant = "default",
  severity,
  syncStatus,
  size = "sm",
}: BadgeProps) {
  const { theme } = useTheme();

  const getColors = (): { bg: string; text: string; border: string } => {
    if (variant === "severity" && severity) {
      const s = theme.colors.severity[severity];
      if (severity === "emergency") {
        return { bg: s.surface, text: s.text, border: s.border };
      }
      return { bg: s.surface, text: s.text, border: s.border };
    }
    if (variant === "sync" && syncStatus) {
      const s = theme.colors.sync[syncStatus];
      return { bg: s.surface, text: s.color, border: "transparent" };
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
        border: "transparent",
      },
    };
    return map[variant];
  };

  const c = getColors();
  const isEmergency = variant === "severity" && severity === "emergency";
  const isSyncBadge = variant === "sync" && syncStatus !== undefined;
  const dot = isSyncBadge ? SYNC_DOTS[syncStatus] : null;

  return (
    <View
      style={[
        styles.base,
        size === "md" && styles.md,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: c.border === "transparent" ? 0 : 1,
        },
        isEmergency && styles.emergency,
      ]}
    >
      {dot && (
        <Text
          variant="caption"
          color={c.text}
          style={[styles.dot, syncStatus === "conflict" && styles.conflictDot]}
        >
          {dot}{" "}
        </Text>
      )}
      <Text
        variant="caption"
        color={c.text}
        style={[styles.label, isEmergency && styles.emergencyLabel]}
      >
        {isEmergency ? label.toUpperCase() : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  emergency: {
    elevation: 2,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  dot: { fontWeight: "700", lineHeight: 16 },
  conflictDot: { color: "#D97706" },
  label: { fontWeight: "600", letterSpacing: 0.1 },
  emergencyLabel: { fontWeight: "700", letterSpacing: 0.6 },
});
