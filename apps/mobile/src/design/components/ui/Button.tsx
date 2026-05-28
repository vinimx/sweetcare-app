import React from "react";
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
} from "react-native";
import { Text } from "./Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import { haptics } from "../../utils/haptics.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "emergency";
type ButtonSize = "sm" | "md" | "lg" | "emergency";

interface ButtonProps extends Omit<TouchableOpacityProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  label,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  style,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();

  const variantStyles = {
    primary: {
      bg: theme.colors.primary.DEFAULT,
      text: theme.colors.text.inverse,
      border: "transparent",
    },
    secondary: {
      bg: theme.colors.surface.DEFAULT,
      text: theme.colors.primary.DEFAULT,
      border: theme.colors.primary.border,
    },
    ghost: { bg: "transparent", text: theme.colors.primary.DEFAULT, border: "transparent" },
    danger: {
      bg: theme.colors.error.DEFAULT,
      text: theme.colors.text.inverse,
      border: "transparent",
    },
    emergency: { bg: "#DC2626", text: theme.colors.text.inverse, border: "#B91C1C" },
  };

  const sizeStyles = {
    sm: { height: 36, paddingH: 12, shadow: theme.shadows.none },
    md: { height: 48, paddingH: 16, shadow: theme.shadows.md },
    lg: { height: 56, paddingH: 20, shadow: theme.shadows.md },
    emergency: { height: 64, paddingH: 24, shadow: theme.shadows.emergency },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];
  const isDisabled = disabled || loading;

  const handlePress: TouchableOpacityProps["onPress"] = (e) => {
    if (variant === "emergency") haptics.emergency();
    else haptics.medium();
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          height: ss.height,
          paddingHorizontal: ss.paddingH,
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderWidth: vs.border !== "transparent" ? 1.5 : 0,
          ...ss.shadow,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <View style={styles.inner}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            variant={size === "sm" ? "buttonSm" : "button"}
            color={vs.text}
            style={variant === "emergency" ? styles.emergencyText : undefined}
          >
            {label}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.4 },
  inner: { flexDirection: "row", alignItems: "center" },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  emergencyText: { fontWeight: "700", letterSpacing: 0.3 },
});
