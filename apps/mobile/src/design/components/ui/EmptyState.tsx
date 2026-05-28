import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "./Text.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { useTheme } from "../../contexts/ThemeContext.js";

type EmptyVariant = "default" | "offline" | "noRecords" | "noPatient" | "loadError";

interface EmptyStateProps {
  title?: string;
  description?: string;
  variant?: EmptyVariant;
  action?: { label: string; onPress: () => void; accessibilityLabel: string };
}

const VARIANT_DEFAULTS: Record<EmptyVariant, { icon: string; title: string; desc?: string }> = {
  default: { icon: "inbox", title: "Nada por aqui" },
  offline: {
    icon: "wifi-off",
    title: "Sem conexão",
    desc: "Registros locais disponíveis. Sincronize ao reconectar.",
  },
  noRecords: {
    icon: "clipboard",
    title: "Nenhum registro ainda",
    desc: "Os registros aparecerão aqui após o primeiro lançamento.",
  },
  noPatient: {
    icon: "heart",
    title: "Nenhum paciente configurado",
    desc: "Adicione um paciente para começar.",
  },
  loadError: {
    icon: "alert-circle",
    title: "Não foi possível carregar",
    desc: "Verifique sua conexão e tente novamente.",
  },
};

export function EmptyState({ title, description, variant = "default", action }: EmptyStateProps) {
  const { theme } = useTheme();
  const defaults = VARIANT_DEFAULTS[variant];

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface.subtle }]}>
        <Icon name={defaults.icon} size="xl" color={theme.colors.text.tertiary} />
      </View>
      <Text variant="h3" align="center" color={theme.colors.text.primary} style={styles.title}>
        {title ?? defaults.title}
      </Text>
      {(description ?? defaults.desc) && (
        <Text variant="body" align="center" color={theme.colors.text.secondary} style={styles.desc}>
          {description ?? defaults.desc}
        </Text>
      )}
      {action && (
        <Button
          variant="secondary"
          size="md"
          label={action.label}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 32 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { marginBottom: 8 },
  desc: { marginBottom: 4 },
  action: { marginTop: 20 },
});
