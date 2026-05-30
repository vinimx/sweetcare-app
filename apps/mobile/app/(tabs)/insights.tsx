import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "../../src/design/components/ui/Button.js";
import { EmptyState } from "../../src/design/components/ui/EmptyState.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import InsightsDashboardScreen from "../../src/features/insights/screens/InsightsDashboardScreen.js";
import ReportDetailScreen from "../../src/features/insights/screens/ReportDetailScreen.js";

export default function InsightsTab() {
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  if (!activePatient) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <EmptyState
          variant="noPatient"
          title="Nenhum paciente selecionado"
          message="Adicione um paciente para visualizar insights e relatórios de IA."
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

  if (selectedReportId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <ReportDetailScreen
          reportId={selectedReportId}
          onBack={() => {
            setSelectedReportId(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      <InsightsDashboardScreen patientId={activePatient.id} onSelectReport={setSelectedReportId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
