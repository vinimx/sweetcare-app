import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../src/design/components/ui/Text.js";
import { Icon } from "../src/design/components/ui/Icon.js";
import { Divider } from "../src/design/components/ui/Divider.js";
import { useTheme } from "../src/design/contexts/ThemeContext.js";

interface Protocol {
  id: string;
  title: string;
  subtitle: string;
  steps: string[];
  callEmergency: boolean;
  icon: string;
}

const PROTOCOLS: Protocol[] = [
  {
    id: "hypo_emergency",
    title: "Perda de Consciência",
    subtitle: "Hipoglicemia grave / convulsão",
    icon: "alert-octagon",
    callEmergency: true,
    steps: [
      "Ligue IMEDIATAMENTE para o SAMU: 192",
      "Posicione a criança deitada de lado (posição de recuperação)",
      "NÃO ofereça nada por via oral",
      "Monitore a respiração até o socorro chegar",
      "Informe ao SAMU: criança com Diabetes Tipo 1",
      "Permaneça ao lado da criança o tempo todo",
    ],
  },
  {
    id: "keto_emergency",
    title: "Cetoacidose Suspeita",
    subtitle: "Respiração acelerada, vômito, confusão",
    icon: "alert-triangle",
    callEmergency: true,
    steps: [
      "Ligue IMEDIATAMENTE para o SAMU: 192",
      "NÃO administre insulina sem orientação médica",
      "Ofereça água apenas se a criança estiver consciente e conseguir engolir",
      "Monitore sinais vitais até o socorro chegar",
      "Informe ao SAMU: criança com Diabetes Tipo 1",
    ],
  },
  {
    id: "hypo_mild",
    title: "Hipoglicemia Leve",
    subtitle: "Tremor, suor, fraqueza — criança consciente",
    icon: "activity",
    callEmergency: false,
    steps: [
      "Ofereça 15g de carboidrato de ação rápida (suco, glicose em gel)",
      "Aguarde 15 minutos",
      "Meça a glicemia novamente",
      "Repita se a glicemia permanecer abaixo de 70 mg/dL",
      "Se não melhorar, acione o SAMU (192)",
      "Registre o episódio no aplicativo após estabilização",
    ],
  },
  {
    id: "hypo_severe",
    title: "Hipoglicemia Grave",
    subtitle: "Criança ainda consciente mas desorientada",
    icon: "zap",
    callEmergency: false,
    steps: [
      "Administre glucagon conforme prescrição médica",
      "Se inconsciente ou não conseguir engolir → ligue 192",
      "Posicione deitado de lado se houver risco de queda",
      "Não force nada por via oral se desorientada",
      "Monitore continuamente até a recuperação",
      "Contate o médico responsável após estabilização",
    ],
  },
  {
    id: "keto_risk",
    title: "Risco de Cetoacidose",
    subtitle: "Sede excessiva, urina frequente, hálito frutado",
    icon: "droplet",
    callEmergency: false,
    steps: [
      "Incentive hidratação com água",
      "Meça cetonas na urina ou sangue imediatamente",
      "Se cetonas > 1,5 mmol/L, contate o médico agora",
      "Monitore a glicemia a cada hora",
      "NÃO administre insulina adicional sem orientação médica",
    ],
  },
];

const EMERGENCY_CONTACTS = [
  { label: "SAMU", number: "192", phone: "192" },
  { label: "Bombeiros", number: "193", phone: "193" },
];

function callNumber(label: string, phone: string) {
  Alert.alert(`Ligar para ${label}`, `Confirma a ligação para ${label} (${phone})?`, [
    { text: "Cancelar", style: "cancel" },
    {
      text: "Ligar agora",
      onPress: () => {
        void Linking.openURL(`tel:${phone}`);
      },
    },
  ]);
}

export default function EmergencyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string>("hypo_emergency");

  function toggleProtocol(id: string) {
    setExpandedId((prev) => (prev === id ? "" : id));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Emergency call strip — always visible */}
        <View style={styles.callStrip}>
          <Text variant="h4" color="#fff" style={styles.callLabel}>
            Ligue agora se houver emergência
          </Text>
          <View style={styles.callButtons}>
            {EMERGENCY_CONTACTS.map((c) => (
              <TouchableOpacity
                key={c.label}
                style={styles.callBtn}
                onPress={() => {
                  callNumber(c.label, c.phone);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Ligar para ${c.label} ${c.number}`}
              >
                <Icon name="phone" size="md" color="#fff" />
                <View>
                  <Text variant="button" color="#fff">
                    {c.label}
                  </Text>
                  <Text variant="caption" color="#FECACA">
                    {c.number}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Offline notice */}
        <View style={styles.offlineNotice}>
          <Icon name="wifi-off" size="xs" color={theme.colors.text.tertiary} />
          <Text variant="caption" color={theme.colors.text.tertiary}>
            {" "}
            Protocolo disponível sem internet
          </Text>
        </View>

        {/* Protocol list */}
        <Text variant="h4" style={styles.sectionTitle}>
          Protocolos de emergência
        </Text>

        {PROTOCOLS.map((protocol) => {
          const isExpanded = expandedId === protocol.id;
          const isEmergencyLevel = protocol.callEmergency;
          return (
            <View
              key={protocol.id}
              style={[
                styles.protocolCard,
                {
                  backgroundColor: isEmergencyLevel ? "#FEF2F2" : theme.colors.surface.DEFAULT,
                  borderColor: isEmergencyLevel ? "#FECACA" : theme.colors.border.DEFAULT,
                  ...theme.shadows.sm,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.protocolHeader}
                onPress={() => {
                  toggleProtocol(protocol.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${protocol.title}: ${protocol.subtitle}`}
              >
                <View
                  style={[
                    styles.protocolIcon,
                    {
                      backgroundColor: isEmergencyLevel
                        ? "#FEE2E2"
                        : theme.colors.background.DEFAULT,
                    },
                  ]}
                >
                  <Icon
                    name={protocol.icon}
                    size="md"
                    color={isEmergencyLevel ? "#DC2626" : theme.colors.text.secondary}
                  />
                </View>
                <View style={styles.protocolTitleBlock}>
                  <Text
                    variant="h4"
                    color={isEmergencyLevel ? "#DC2626" : theme.colors.text.primary}
                  >
                    {protocol.title}
                  </Text>
                  <Text
                    variant="caption"
                    color={isEmergencyLevel ? "#B91C1C" : theme.colors.text.tertiary}
                  >
                    {protocol.subtitle}
                  </Text>
                </View>
                <Icon
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size="sm"
                  color={theme.colors.text.tertiary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.protocolBody}>
                  <Divider />
                  {protocol.callEmergency && (
                    <View style={styles.emergencyBadge}>
                      <Icon name="phone" size="xs" color="#DC2626" />
                      <Text variant="bodySm" color="#DC2626" style={styles.emergencyBadgeText}>
                        Acione o SAMU (192) imediatamente
                      </Text>
                    </View>
                  )}
                  {protocol.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View
                        style={[
                          styles.stepNum,
                          {
                            backgroundColor: isEmergencyLevel
                              ? "#DC2626"
                              : theme.colors.primary.DEFAULT,
                          },
                        ]}
                      >
                        <Text variant="caption" color="#fff">
                          {i + 1}
                        </Text>
                      </View>
                      <Text variant="body" style={styles.stepText}>
                        {step}
                      </Text>
                    </View>
                  ))}
                  <View
                    style={[
                      styles.disclaimerBox,
                      { backgroundColor: theme.colors.background.DEFAULT },
                    ]}
                  >
                    <Text variant="caption" color={theme.colors.text.tertiary}>
                      Este protocolo não substitui orientação médica profissional.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { borderColor: theme.colors.border.DEFAULT }]}
          onPress={() => {
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Fechar protocolo de emergência"
        >
          <Icon name="x" size="sm" color={theme.colors.text.secondary} />
          <Text variant="button" color={theme.colors.text.secondary}>
            Fechar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#7F1D1D" },
  scroll: { paddingBottom: 48 },
  callStrip: {
    backgroundColor: "#DC2626",
    padding: 20,
    gap: 14,
  },
  callLabel: { textAlign: "center" },
  callButtons: { flexDirection: "row", gap: 12 },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 64,
  },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#991B1B",
  },
  sectionTitle: {
    color: "#fff",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  protocolCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  protocolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    minHeight: 72,
  },
  protocolIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  protocolTitleBlock: { flex: 1 },
  protocolBody: { paddingHorizontal: 16, paddingBottom: 16 },
  emergencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  emergencyBadgeText: { flex: 1 },
  stepRow: { flexDirection: "row", gap: 12, marginTop: 12, alignItems: "flex-start" },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  stepText: { flex: 1, lineHeight: 22 },
  disclaimerBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#991B1B",
    minHeight: 56,
  },
});
