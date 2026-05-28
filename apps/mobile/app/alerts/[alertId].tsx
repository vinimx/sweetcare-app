import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { Skeleton } from "../../src/design/components/ui/Skeleton.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../src/infrastructure/api/client.js";
import type { AlertEvent } from "@sweetcare/shared-types";

type GuidanceKey =
  | "HYPO_MILD_PROTOCOL"
  | "HYPO_SEVERE_PROTOCOL"
  | "HYPO_EMERGENCY_PROTOCOL"
  | "KETO_RISK_PROTOCOL"
  | "KETO_EMERGENCY_PROTOCOL";

interface AlertGuidance {
  title: string;
  immediate_steps: string[];
  emergency_contacts: { label: string; phone: string }[];
  seek_emergency_care: boolean;
  disclaimer: string;
}

const DISCLAIMER = "Este guia não substitui orientação médica profissional.";
const EMERGENCY_CONTACTS = [
  { label: "SAMU", phone: "+55192" },
  { label: "Bombeiros", phone: "+55193" },
];

const ALERT_GUIDANCE: Record<GuidanceKey, AlertGuidance> = {
  HYPO_MILD_PROTOCOL: {
    title: "Hipoglicemia Leve",
    immediate_steps: [
      "Ofereça 15g de carboidrato de ação rápida (suco de laranja, glicose em gel)",
      "Aguarde 15 minutos e reavalie a glicemia",
      "Repita se a glicemia permanecer abaixo de 70 mg/dL",
      "Registre o episódio no aplicativo após a estabilização",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  HYPO_SEVERE_PROTOCOL: {
    title: "Hipoglicemia Grave",
    immediate_steps: [
      "Administre glucagon conforme prescrição médica",
      "Se inconsciente, posicione deitado de lado (posição de recuperação)",
      "Não ofereça nada por via oral se inconsciente",
      "Monitore continuamente até a recuperação da consciência",
      "Contate o médico responsável imediatamente após a estabilização",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  HYPO_EMERGENCY_PROTOCOL: {
    title: "Emergência — Perda de Consciência",
    immediate_steps: [
      "Ligue imediatamente para o SAMU: 192",
      "Posicione a criança deitada de lado",
      "Não ofereça nada por via oral",
      "Monitore a respiração até a chegada do socorro",
      "Informe ao SAMU que a criança é diabética tipo 1",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: true,
    disclaimer: DISCLAIMER,
  },
  KETO_RISK_PROTOCOL: {
    title: "Risco de Cetoacidose",
    immediate_steps: [
      "Incentive hidratação com água",
      "Meça cetonas na urina ou no sangue imediatamente",
      "Contate o médico se cetonas elevadas (> 1,5 mmol/L)",
      "Monitore a glicemia a cada hora",
      "Não administre insulina adicional sem orientação médica",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  KETO_EMERGENCY_PROTOCOL: {
    title: "Emergência — Cetoacidose Suspeita",
    immediate_steps: [
      "Ligue imediatamente para o SAMU: 192",
      "Não administre insulina sem orientação médica",
      "Hidrate apenas se a criança estiver consciente e conseguir engolir",
      "Monitore os sinais vitais até a chegada do socorro",
      "Informe ao SAMU que a criança é diabética tipo 1",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: true,
    disclaimer: DISCLAIMER,
  },
};

const SEVERITY_LABEL: Record<string, string> = {
  warning: "Atenção",
  critical: "Crítico",
  emergency: "Emergência",
};

export default function AlertDetailScreen() {
  const { theme } = useTheme();
  const { alertId } = useLocalSearchParams<{ alertId: string }>();
  const { activePatient } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resolveLoading, setResolveLoading] = useState(false);

  const { data: alert, isLoading } = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => apiClient.get<AlertEvent>(`/alerts/${alertId}`),
    enabled: !!alertId,
  });

  const resolveAlert = useMutation({
    mutationFn: () => apiClient.patch(`/alerts/${alertId}/resolve`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alert", alertId] });
      void queryClient.invalidateQueries({ queryKey: ["timeline", activePatient?.id] });
      setResolveLoading(false);
      router.back();
    },
    onError: () => {
      setResolveLoading(false);
      Alert.alert("Erro", "Não foi possível resolver o alerta. Tente novamente.");
    },
  });

  function handleResolve() {
    Alert.alert(
      "Resolver alerta",
      "Confirma que a situação foi tratada e o alerta pode ser fechado?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            setResolveLoading(true);
            resolveAlert.mutate();
          },
        },
      ],
    );
  }

  function callEmergency(phone: string, label: string) {
    const url = `tel:${phone.replace("+55", "")}`;
    Alert.alert(`Ligar para ${label}`, `Confirma a ligação para ${label}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Ligar",
        onPress: () => {
          void Linking.openURL(url);
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={120} borderRadius={16} style={styles.skeletonItem} />
          <Skeleton width="100%" height={200} borderRadius={16} style={styles.skeletonItem} />
        </View>
      </SafeAreaView>
    );
  }

  if (!alert) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <View style={styles.notFound}>
          <Text variant="bodyMd" color={theme.colors.text.secondary}>
            Alerta não encontrado.
          </Text>
          <Button
            variant="ghost"
            size="md"
            label="Voltar"
            onPress={() => {
              router.back();
            }}
            accessibilityLabel="Voltar"
            style={styles.backBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isEmergency = alert.severityLevel === "emergency";
  const guidance = ALERT_GUIDANCE[alert.guidanceKey as GuidanceKey];

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isEmergency ? "#7F1D1D" : theme.colors.background.DEFAULT },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Severity banner */}
        <View
          style={[styles.severityBanner, { backgroundColor: isEmergency ? "#DC2626" : "#FEF2F2" }]}
        >
          <Icon
            name={isEmergency ? "alert-octagon" : "alert-triangle"}
            size="xl"
            color={isEmergency ? "#fff" : "#DC2626"}
          />
          <View style={styles.severityInfo}>
            <Text variant="h3" color={isEmergency ? "#fff" : "#DC2626"}>
              {SEVERITY_LABEL[alert.severityLevel] ?? alert.severityLevel}
            </Text>
            <Text variant="bodySm" color={isEmergency ? "#FECACA" : "#B91C1C"}>
              {new Date(alert.createdAt).toLocaleString("pt-BR")}
            </Text>
          </View>
          {alert.resolvedAt && (
            <View style={[styles.resolvedBadge, { backgroundColor: "#16A34A" }]}>
              <Icon name="check" size="xs" color="#fff" />
              <Text variant="caption" color="#fff">
                Resolvido
              </Text>
            </View>
          )}
        </View>

        {/* Guidance card */}
        <View
          style={[
            styles.guidanceCard,
            { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.lg },
          ]}
        >
          <Text variant="h3" style={styles.guidanceTitle}>
            {guidance.title}
          </Text>

          <Text variant="h4" style={styles.stepsLabel}>
            Orientações imediatas:
          </Text>
          {guidance.immediate_steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: isEmergency ? "#DC2626" : theme.colors.primary.DEFAULT },
                ]}
              >
                <Text variant="caption" color="#fff">
                  {i + 1}
                </Text>
              </View>
              <Text variant="bodyMd" style={styles.stepText}>
                {step}
              </Text>
            </View>
          ))}

          {/* Emergency contacts */}
          {guidance.seek_emergency_care && (
            <View
              style={[
                styles.emergencySection,
                { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
              ]}
            >
              <Text variant="h4" color="#DC2626" style={styles.emergencyLabel}>
                Acione o socorro imediatamente
              </Text>
              <View style={styles.contactButtons}>
                {guidance.emergency_contacts.map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    style={[styles.contactBtn, { backgroundColor: "#DC2626" }]}
                    onPress={() => {
                      callEmergency(c.phone, c.label);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Ligar para ${c.label}`}
                  >
                    <Icon name="phone" size="sm" color="#fff" />
                    <Text variant="button" color="#fff">
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Disclaimer */}
          <View
            style={[styles.disclaimerBox, { backgroundColor: theme.colors.background.DEFAULT }]}
          >
            <Icon name="info" size="xs" color={theme.colors.text.tertiary} />
            <Text
              variant="caption"
              color={theme.colors.text.tertiary}
              style={styles.disclaimerText}
            >
              {guidance.disclaimer}
            </Text>
          </View>
        </View>

        {/* Resolve button */}
        {!alert.resolvedAt && (
          <Button
            variant="primary"
            size="lg"
            label="Marcar como resolvido"
            onPress={handleResolve}
            loading={resolveLoading}
            fullWidth
            leftIcon={<Icon name="check-circle" size="sm" color="#fff" />}
            accessibilityLabel="Confirmar que o alerta foi tratado e resolvido"
            style={styles.resolveBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  loadingContainer: { padding: 16 },
  skeletonItem: { marginBottom: 12 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  backBtn: {},
  severityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  severityInfo: { flex: 1 },
  resolvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  guidanceCard: { borderRadius: 16, padding: 22, marginBottom: 20 },
  guidanceTitle: { marginBottom: 18 },
  stepsLabel: { marginBottom: 12 },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  stepText: { flex: 1, lineHeight: 22 },
  emergencySection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  emergencyLabel: { marginBottom: 12 },
  contactButtons: { flexDirection: "row", gap: 12 },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 56,
  },
  disclaimerBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  disclaimerText: { flex: 1, lineHeight: 16 },
  resolveBtn: { marginTop: 4 },
});
