import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { Divider } from "../../src/design/components/ui/Divider.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../src/infrastructure/api/client.js";

function SettingsRow({
  icon,
  label,
  sublabel,
  onPress,
  destructive = false,
  rightElement,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  destructive?: boolean;
  rightElement?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.colors.border.subtle }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: destructive
              ? theme.colors.error.surface
              : theme.colors.background.DEFAULT,
          },
        ]}
      >
        <Icon
          name={icon}
          size="sm"
          color={destructive ? theme.colors.error.DEFAULT : theme.colors.text.secondary}
        />
      </View>
      <View style={styles.rowContent}>
        <Text
          variant="body"
          color={destructive ? theme.colors.error.DEFAULT : theme.colors.text.primary}
        >
          {label}
        </Text>
        {sublabel && (
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {sublabel}
          </Text>
        )}
      </View>
      {rightElement ??
        (onPress ? (
          <Icon name="chevron-right" size="sm" color={theme.colors.text.tertiary} />
        ) : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, activePatient, logout } = useAuth();
  const router = useRouter();
  const [exportLoading, setExportLoading] = useState(false);

  async function handleExportData() {
    setExportLoading(true);
    try {
      await apiClient.get("/users/me/data-export");
      Alert.alert(
        "Exportação solicitada",
        "Seus dados foram exportados com sucesso. Em um app de produção, o arquivo seria enviado ao seu e-mail.",
      );
    } catch {
      Alert.alert("Erro", "Não foi possível exportar os dados. Tente novamente.");
    } finally {
      setExportLoading(false);
    }
  }

  function handleDeleteAccount() {
    Alert.prompt(
      "Excluir conta",
      "Esta ação é irreversível. Informe sua senha para confirmar a exclusão de todos os seus dados.",
      (password) => {
        if (!password) return;
        void (async () => {
          try {
            await apiClient.delete("/users/me", { password });
            await logout();
          } catch {
            Alert.alert("Erro", "Senha incorreta ou não foi possível excluir a conta.");
          }
        })();
      },
      "secure-text",
    );
  }

  function handleLogout() {
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.pageTitle}>
          Perfil
        </Text>

        {/* User card */}
        <View
          style={[
            styles.userCard,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.md },
          ]}
        >
          <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary.surface }]}>
            <Text variant="h2" color={theme.colors.primary.DEFAULT}>
              {user?.displayName.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text variant="h4">{user?.displayName ?? "—"}</Text>
            <Text variant="bodySm" color={theme.colors.text.secondary}>
              {user?.email ?? "—"}
            </Text>
            <Text variant="caption" color={theme.colors.text.tertiary} style={styles.roleText}>
              {user?.role === "guardian"
                ? "Responsável"
                : user?.role === "caregiver"
                  ? "Cuidador"
                  : (user?.role ?? "—")}
            </Text>
          </View>
        </View>

        {/* Patient section */}
        <Text variant="h4" style={styles.sectionTitle}>
          Paciente ativo
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.sm },
          ]}
        >
          {activePatient ? (
            <>
              <SettingsRow
                icon="heart"
                label={activePatient.fullName}
                sublabel={`Diagnóstico em ${String(activePatient.diagnosisYear)} · Alvo: ${String(activePatient.targetGlucoseMinMgdl)}–${String(activePatient.targetGlucoseMaxMgdl)} mg/dL`}
              />
              <SettingsRow
                icon="user-plus"
                label="Trocar paciente"
                onPress={() => {
                  router.push("/patients/new");
                }}
              />
            </>
          ) : (
            <SettingsRow
              icon="user-plus"
              label="Adicionar paciente"
              onPress={() => {
                router.push("/patients/new");
              }}
            />
          )}
        </View>

        {/* LGPD section */}
        <Text variant="h4" style={styles.sectionTitle}>
          Privacidade e dados (LGPD)
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.sm },
          ]}
        >
          <SettingsRow
            icon="download"
            label="Exportar meus dados"
            sublabel="Art. 18 — direito de acesso"
            onPress={
              exportLoading
                ? undefined
                : () => {
                    void handleExportData();
                  }
            }
            rightElement={
              exportLoading ? (
                <Icon name="loader" size="sm" color={theme.colors.text.tertiary} />
              ) : undefined
            }
          />
          <Divider />
          <SettingsRow
            icon="trash-2"
            label="Excluir minha conta"
            sublabel="Art. 18 — direito ao esquecimento"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>

        {/* App info */}
        <Text variant="h4" style={styles.sectionTitle}>
          Aplicativo
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.sm },
          ]}
        >
          <SettingsRow
            icon="shield"
            label="Segurança dos dados"
            sublabel="AES-256-GCM · TLS 1.3 · argon2id"
          />
          <Divider />
          <SettingsRow icon="info" label="Versão" sublabel="SweetCare 1.0.0 — API v1" />
        </View>

        {/* Logout */}
        <Button
          variant="danger"
          size="lg"
          label="Sair da conta"
          onPress={handleLogout}
          fullWidth
          leftIcon={<Icon name="log-out" size="sm" color="#fff" />}
          accessibilityLabel="Encerrar sessão e sair da conta"
          style={styles.logoutBtn}
        />

        <Text
          variant="caption"
          color={theme.colors.text.tertiary}
          align="center"
          style={styles.footer}
        >
          Seus dados são armazenados com criptografia{"\n"}e protegidos pela LGPD Art. 14.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  pageTitle: { marginBottom: 20 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 28,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  roleText: { marginTop: 2 },
  sectionTitle: { marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  logoutBtn: { marginTop: 8, marginBottom: 20 },
  footer: { lineHeight: 18 },
});
