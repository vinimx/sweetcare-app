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
import type { PatientProfile } from "@sweetcare/shared-types";

/* ── SettingsRow ────────────────────────────────────────────────── */
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

/* ── PatientRow ─────────────────────────────────────────────────── */
function PatientRow({
  patient,
  isActive,
  onSelect,
  onEdit,
}: {
  patient: PatientProfile;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.patientRow,
        {
          borderBottomColor: theme.colors.border.subtle,
          backgroundColor: isActive ? theme.colors.primary.surface : theme.colors.surface.DEFAULT,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.patientRowContent}
        onPress={onSelect}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar ${patient.fullName} como paciente ativo`}
        accessibilityState={{ selected: isActive }}
      >
        <View
          style={[
            styles.patientAvatar,
            {
              backgroundColor: isActive
                ? theme.colors.primary.DEFAULT
                : theme.colors.surface.subtle,
            },
          ]}
        >
          <Icon name="heart" size="sm" color={isActive ? "#fff" : theme.colors.text.tertiary} />
        </View>
        <View style={styles.patientInfo}>
          <Text
            variant="body"
            color={isActive ? theme.colors.primary.DEFAULT : theme.colors.text.primary}
            style={isActive ? styles.patientNameActive : undefined}
          >
            {patient.fullName}
          </Text>
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {`Diagnóstico: ${String(patient.diagnosisYear)} · Alvo: ${String(patient.targetGlucoseMinMgdl)}–${String(patient.targetGlucoseMaxMgdl)} mg/dL`}
          </Text>
        </View>
        {isActive && <Icon name="check-circle" size="sm" color={theme.colors.primary.DEFAULT} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.patientEditBtn}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Editar dados de ${patient.fullName}`}
      >
        <Icon name="edit-2" size="sm" color={theme.colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────────────── */
export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, patients, activePatient, setActivePatient, logout } = useAuth();
  const router = useRouter();
  const [exportLoading, setExportLoading] = useState(false);

  async function handleExportData() {
    setExportLoading(true);
    try {
      await apiClient.get("/users/me/data-export");
      Alert.alert(
        "Dados exportados",
        "Seus dados foram preparados. Em breve você receberá um arquivo no e-mail cadastrado.",
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
      "Esta ação é irreversível. Todos os seus dados e registros médicos serão removidos permanentemente. Informe sua senha para confirmar.",
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

  const roleLabel =
    user?.role === "guardian"
      ? "Responsável"
      : user?.role === "caregiver"
        ? "Cuidador"
        : (user?.role ?? "—");

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.pageTitle}>
          Perfil
        </Text>

        {/* User card — tappable → edit profile */}
        <TouchableOpacity
          style={[
            styles.userCard,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.md },
          ]}
          onPress={() => {
            router.push("/profile/edit");
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
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
              {roleLabel}
            </Text>
          </View>
          <Icon name="chevron-right" size="sm" color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        {/* Patients section */}
        <Text variant="h4" style={styles.sectionTitle}>
          Meus pacientes
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.sm },
          ]}
        >
          {patients.length === 0 ? (
            <SettingsRow
              icon="user-plus"
              label="Adicionar paciente"
              sublabel="Nenhum paciente cadastrado"
              onPress={() => {
                router.push("/patients/new");
              }}
            />
          ) : (
            <>
              {patients.map((patient, index) => (
                <React.Fragment key={patient.id}>
                  {index > 0 && <Divider />}
                  <PatientRow
                    patient={patient}
                    isActive={activePatient?.id === patient.id}
                    onSelect={() => {
                      void setActivePatient(patient);
                    }}
                    onEdit={() => {
                      router.push({
                        pathname: "/patients/edit/[id]",
                        params: { id: patient.id },
                      });
                    }}
                  />
                </React.Fragment>
              ))}
              <Divider />
              <SettingsRow
                icon="user-plus"
                label="Novo paciente"
                onPress={() => {
                  router.push("/patients/new");
                }}
              />
            </>
          )}
        </View>

        {/* Privacy section */}
        <Text variant="h4" style={styles.sectionTitle}>
          Privacidade
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
            sublabel="Baixe uma cópia de todos os seus dados"
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
            sublabel="Remove permanentemente todos os seus dados"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>

        {/* App section */}
        <Text variant="h4" style={styles.sectionTitle}>
          Sobre o app
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.sm },
          ]}
        >
          <SettingsRow
            icon="shield"
            label="Segurança"
            sublabel="Seus dados são criptografados no dispositivo e em trânsito"
          />
          <Divider />
          <SettingsRow icon="info" label="Versão" sublabel="SweetCare 1.0.0" />
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
          Seus dados são protegidos com criptografia de ponta a ponta.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  pageTitle: { marginBottom: 20 },

  /* User card */
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

  /* Sections */
  sectionTitle: { marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },

  /* Generic row */
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

  /* Patient rows */
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
  },
  patientRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 8,
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  patientInfo: { flex: 1 },
  patientNameActive: { fontWeight: "600" },
  patientEditBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 4,
  },

  /* Footer */
  logoutBtn: { marginTop: 8, marginBottom: 20 },
  footer: { lineHeight: 18 },
});
