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
}

export function Card({
  variant = "default",
  severity,
  onPress,
  padding,
  style,
  children,
  accessibilityLabel,
}: CardProps) {
  const { theme } = useTheme();

  const getStyle = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: theme.colors.surface.DEFAULT,
      borderRadius: theme.radii.lg,
      padding: padding ?? theme.spacing[4],
    };
    if (variant === "elevated") return { ...base, ...theme.shadows.md };
    if (variant === "outlined")
      return { ...base, borderWidth: 1, borderColor: theme.colors.border.DEFAULT };
    if (variant === "severity" && severity) {
      const s = theme.colors.severity[severity];
      return {
        ...base,
        backgroundColor: s.surface,
        borderWidth: 1.5,
        borderColor: s.border,
        ...theme.shadows.sm,
      };
    }
    return { ...base, ...theme.shadows.sm };
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getStyle(), style]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[getStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({});
void styles;
