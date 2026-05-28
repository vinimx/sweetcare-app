import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { radii } from "../../themes/spacing.js";

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  radius?: keyof typeof radii;
  borderRadius?: number;
  animated?: boolean;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height,
  radius = "md",
  borderRadius,
  animated = true,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [animated, opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? theme.radii[radius],
          backgroundColor: theme.colors.border.DEFAULT,
          opacity: animated ? opacity : 0.4,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({});
void styles;
