import React from "react";
import { TouchableOpacity, View, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { SeverityLevel } from "@sweetcare/shared-types";

type CardVariant = "default" | "elevated" | "outlined" | "severity";

interface CardProps {
  variant?: CardVariant;
  severity?: SeverityLevel;
  onPress?: () => void;
  padding?: number;
  style?: ViewStyle;
  children: React.ReactNode;
  accessibilityLabel?: string;
  /** 4px colored left accent bar — card switches to row layout automatically */
  accentColor?: string;
}

export function Card({
  variant = "default",
  severity,
  onPress,
  padding,
  style,
  children,
  accessibilityLabel,
  accentColor,
}: CardProps) {
  const { theme } = useTheme();

  const baseRadius = theme.radii.xl; // 16px — more refined than 12

  const getContainerStyle = (): ViewStyle => {
    const shared: ViewStyle = {
      borderRadius: baseRadius,
      overflow: "hidden",
    };

    if (accentColor) {
      // When accent is active, the outer container has no padding (accent bar + inner View handle it)
      if (variant === "elevated") return { ...shared, ...theme.shadows.md };
      if (variant === "outlined")
        return {
          ...shared,
          borderWidth: 1,
          borderColor: theme.colors.border.DEFAULT,
        };
      if (variant === "severity" && severity) {
        const s = theme.colors.severity[severity];
        return {
          ...shared,
          backgroundColor: s.surface,
          borderWidth: 1.5,
          borderColor: s.border,
          ...theme.shadows.sm,
        };
      }
      return {
        ...shared,
        backgroundColor: theme.colors.surface.DEFAULT,
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.15)",
        ...theme.shadows.sm,
      };
    }

    const p = padding ?? theme.spacing[4];
    if (variant === "elevated")
      return {
        ...shared,
        backgroundColor: theme.colors.surface.DEFAULT,
        padding: p,
        ...theme.shadows.md,
      };
    if (variant === "outlined")
      return {
        ...shared,
        backgroundColor: theme.colors.surface.DEFAULT,
        padding: p,
        borderWidth: 1,
        borderColor: theme.colors.border.DEFAULT,
      };
    if (variant === "severity" && severity) {
      const s = theme.colors.severity[severity];
      return {
        ...shared,
        backgroundColor: s.surface,
        padding: p,
        borderWidth: 1.5,
        borderColor: s.border,
        ...theme.shadows.sm,
      };
    }
    return {
      ...shared,
      backgroundColor: theme.colors.surface.DEFAULT,
      padding: p,
      borderWidth: 1,
      borderColor: "rgba(148,163,184,0.15)",
      ...theme.shadows.sm,
    };
  };

  const inner = accentColor ? (
    <View style={styles.accentRow}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={[styles.accentContent, { padding: padding ?? theme.spacing[4] }]}>
        {children}
      </View>
    </View>
  ) : (
    children
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getContainerStyle(), style]}
        onPress={onPress}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={[getContainerStyle(), style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  accentRow: {
    flexDirection: "row",
    flex: 1,
  },
  accentBar: {
    width: 4,
  },
  accentContent: {
    flex: 1,
  },
});
