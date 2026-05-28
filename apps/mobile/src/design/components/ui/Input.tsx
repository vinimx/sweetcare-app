import React, { useState } from "react";
import { View, TextInput, type TextInputProps, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./Text.js";
import { useTheme } from "../../contexts/ThemeContext.js";

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  secureToggle?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftElement,
    rightElement,
    secureToggle,
    style,
    accessibilityLabel,
    accessibilityHint,
    secureTextEntry,
    ...props
  },
  ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  const borderColor = error
    ? theme.colors.error.DEFAULT
    : focused
      ? theme.colors.primary.DEFAULT
      : theme.colors.border.DEFAULT;

  const borderWidth = focused || error ? 1.5 : 1;

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text
          variant="label"
          color={error ? theme.colors.error.DEFAULT : theme.colors.text.secondary}
          style={styles.label}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          {
            borderColor,
            borderWidth,
            backgroundColor:
              props.editable === false ? theme.colors.surface.subtle : theme.colors.surface.DEFAULT,
          },
        ]}
      >
        {leftElement && <View style={styles.leftEl}>{leftElement}</View>}
        <TextInput
          ref={ref}
          style={[styles.input, { color: theme.colors.text.primary }, style]}
          placeholderTextColor={theme.colors.text.tertiary}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          secureTextEntry={secureToggle ? secure : secureTextEntry}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          {...props}
        />
        {secureToggle && (
          <TouchableOpacity
            onPress={() => {
              setSecure((v) => !v);
            }}
            style={styles.rightEl}
            accessibilityLabel={secure ? "Mostrar senha" : "Ocultar senha"}
          >
            <Text variant="caption" color={theme.colors.text.tertiary}>
              {secure ? "Mostrar" : "Ocultar"}
            </Text>
          </TouchableOpacity>
        )}
        {!secureToggle && rightElement && <View style={styles.rightEl}>{rightElement}</View>}
      </View>
      {error ? (
        <Text variant="caption" color={theme.colors.error.DEFAULT} style={styles.hint}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={theme.colors.text.tertiary} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: { marginBottom: 6 },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12, includeFontPadding: false },
  leftEl: { marginRight: 10 },
  rightEl: { marginLeft: 10 },
  hint: { marginTop: 4 },
});
