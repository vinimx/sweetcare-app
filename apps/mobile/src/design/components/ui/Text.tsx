import React from "react";
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { textVariants } from "../../themes/typography.js";

interface TextProps extends RNTextProps {
  variant?: keyof typeof textVariants;
  color?: string;
  align?: "left" | "center" | "right";
}

export function Text({ variant = "body", color, align, style, children, ...props }: TextProps) {
  const { theme } = useTheme();
  const variantStyle = theme.typography.textVariants[variant];

  return (
    <RNText
      style={[
        styles.base,
        variantStyle,
        { color: color ?? theme.colors.text.primary },
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
