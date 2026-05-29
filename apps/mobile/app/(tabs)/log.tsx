import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { EmptyState } from "../../src/design/components/ui/EmptyState.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { useRouter } from "expo-router";
import InsulinLogScreen from "../../src/features/insulin/screens/InsulinLogScreen.js";
import SymptomRecordScreen from "../../src/features/symptoms/screens/SymptomRecordScreen.js";
import type { SuccessSignal } from "../../src/infrastructure/api/timeline.types.js";

type Tab = "insulin" | "symptom";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "insulin", label: "Insulina", icon: "💉" },
  { id: "symptom", label: "Sintoma", icon: "🩺" },
];

export default function LogScreen() {
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("insulin");

  function handleSuccess(type: "insulin" | "symptom") {
    queryClient.setQueryData<SuccessSignal>(["_success_signal"], { type, ts: Date.now() });
    void queryClient.invalidateQueries({ queryKey: ["timeline", activePatient?.id] });
    router.navigate("/");
  }

  if (!activePatient) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <EmptyState
          variant="noPatient"
          title="Nenhum paciente selecionado"
          message="Adicione um paciente antes de registrar insulina ou sintoma."
          action={
            <Button
              variant="primary"
              size="lg"
              label="Adicionar paciente"
              onPress={() => {
                router.push("/patients/new");
              }}
              accessibilityLabel="Ir para adicionar novo paciente"
            />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      {/* Segmented control */}
      <View
        style={[
          styles.segmentWrapper,
          {
            backgroundColor: theme.colors.surface.DEFAULT,
            borderBottomColor: theme.colors.border.subtle,
          },
        ]}
      >
        <View style={[styles.segment, { backgroundColor: theme.colors.background.DEFAULT }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.segmentBtn,
                  isActive && {
                    backgroundColor: theme.colors.surface.DEFAULT,
                    ...theme.shadows.sm,
                  },
                ]}
                onPress={() => {
                  setActiveTab(tab.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Registrar ${tab.label}`}
              >
                <Text style={styles.segmentEmoji}>{tab.icon}</Text>
                <Text
                  variant="button"
                  color={isActive ? theme.colors.primary.DEFAULT : theme.colors.text.tertiary}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active patient chip */}
        <View style={[styles.patientChip, { backgroundColor: theme.colors.primary.surface }]}>
          <Text variant="caption" color={theme.colors.primary.dark} numberOfLines={1}>
            {activePatient.fullName}
          </Text>
        </View>
      </View>

      {/* Form */}
      <View style={styles.formContainer}>
        {activeTab === "insulin" ? (
          <InsulinLogScreen
            patientId={activePatient.id}
            onSuccess={() => {
              handleSuccess("insulin");
            }}
          />
        ) : (
          <SymptomRecordScreen
            patientId={activePatient.id}
            onSuccess={() => {
              handleSuccess("symptom");
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  segmentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  segmentEmoji: { fontSize: 16 },
  patientChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formContainer: { flex: 1 },
});
