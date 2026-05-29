import React, { useRef, useEffect } from "react";
import {
  Animated,
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import { haptics } from "../../utils/haptics.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "emergency";
type ButtonSize = "sm" | "md" | "lg" | "emergency";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
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
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const emergencyPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant !== "emergency" || disabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(emergencyPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(emergencyPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [variant, disabled, emergencyPulse]);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 280,
      friction: 12,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  };

  const handlePress = () => {
    if (variant === "emergency") haptics.emergency();
    else if (variant === "danger") haptics.heavy();
    else haptics.medium();
    onPress?.();
  };

  const VC = {
    primary: {
      bg: theme.colors.primary.DEFAULT,
      fg: "#fff",
      bw: 0,
      bc: "transparent",
      shine: true,
    },
    secondary: {
      bg: "#fff",
      fg: theme.colors.primary.DEFAULT,
      bw: 1.5,
      bc: theme.colors.primary.border,
      shine: false,
    },
    ghost: {
      bg: "transparent",
      fg: theme.colors.primary.DEFAULT,
      bw: 0,
      bc: "transparent",
      shine: false,
    },
    danger: {
      bg: theme.colors.error.DEFAULT,
      fg: "#fff",
      bw: 0,
      bc: "transparent",
      shine: true,
    },
    emergency: {
      bg: "#DC2626",
      fg: "#fff",
      bw: 1.5,
      bc: "#B91C1C",
      shine: true,
    },
  }[variant];

  const SC = {
    sm: { h: 36, px: 14, sh: theme.shadows.none },
    md: { h: 48, px: 20, sh: theme.shadows.md },
    lg: { h: 56, px: 24, sh: theme.shadows.md },
    emergency: { h: 64, px: 28, sh: theme.shadows.emergency },
  }[size];

  const isDisabled = disabled || loading;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        SC.sh,
        { transform: [{ scale }] },
        fullWidth && styles.fw,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.pressable,
          {
            height: SC.h,
            paddingHorizontal: SC.px,
            backgroundColor: VC.bg,
            borderWidth: VC.bw,
            borderColor: VC.bc,
          },
          fullWidth && styles.fw,
        ]}
      >
        {/* Top-shine on filled buttons */}
        {VC.shine && !isDisabled && <View style={styles.shine} />}

        {loading ? (
          <ActivityIndicator color={VC.fg} size="small" />
        ) : (
          <View style={styles.inner}>
            {leftIcon && <View style={styles.iconL}>{leftIcon}</View>}
            <Text
              variant={size === "sm" ? "buttonSm" : "button"}
              color={VC.fg}
              style={variant === "emergency" ? styles.emTxt : styles.stdTxt}
            >
              {label}
            </Text>
            {rightIcon && <View style={styles.iconR}>{rightIcon}</View>}
          </View>
        )}

        {/* Emergency breathing pulse overlay */}
        {variant === "emergency" && !isDisabled && (
          <Animated.View style={[styles.emGlow, { opacity: emergencyPulse }]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    minWidth: 44,
  },
  pressable: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fw: { width: "100%" },
  disabled: { opacity: 0.38 },
  inner: { flexDirection: "row", alignItems: "center" },
  iconL: { marginRight: 8 },
  iconR: { marginLeft: 8 },
  stdTxt: { letterSpacing: 0.1 },
  emTxt: { fontWeight: "700", letterSpacing: 0.6 },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.11)",
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    pointerEvents: "none",
  },
  emGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.13)",
    pointerEvents: "none",
  },
});
