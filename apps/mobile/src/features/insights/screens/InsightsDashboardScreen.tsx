import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../infrastructure/api/client.js";

const CONSENT_TEXT_VERSION = "1.0.0";

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_summary: "Resumo Semanal",
  glucose_pattern: "Padrão de Glicemia",
  insulin_effectiveness: "Efetividade da Insulina",
  symptom_trend: "Tendência de Sintomas",
};

const STATUS_LABELS: Record<string, string> = {
  processing: "Processando...",
  completed: "Concluído",
  failed: "Falhou",
};

const STATUS_COLORS: Record<string, string> = {
  processing: "#D97706",
  completed: "#16A34A",
  failed: "#DC2626",
};

interface ReportSummary {
  report_id: string;
  status: "processing" | "completed" | "failed";
  report_type: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  is_invalidated: boolean;
}

interface Props {
  patientId: string;
  onSelectReport?: (reportId: string) => void;
}

function useInsightReports(patientId: string) {
  return useQuery({
    queryKey: ["insight-reports", patientId],
    queryFn: async (): Promise<ReportSummary[]> => {
      const data = await apiClient.get<{ reports: ReportSummary[] }>(
        `/insights/reports?patient_id=${patientId}`,
      );
      return data.reports;
    },
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some((r) => r.status === "processing");
      return hasProcessing ? 5000 : false;
    },
  });
}

function useRequestReport(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { report_type: string; period_start: string; period_end: string }) =>
      apiClient.post<{ report_id: string; status: string }>("/insights/reports", {
        patient_id: patientId,
        ...params,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insight-reports", patientId] });
    },
  });
}

function periodForLastDays(days: number): { period_start: string; period_end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    period_start: start.toISOString().split("T")[0] ?? "",
    period_end: end.toISOString().split("T")[0] ?? "",
  };
}

export default function InsightsDashboardScreen({ patientId, onSelectReport }: Props) {
  const [selectedType, setSelectedType] = useState<string>("weekly_summary");
  const [needsConsent, setNeedsConsent] = useState(false);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const { data: reports, isLoading, isRefetching, refetch } = useInsightReports(patientId);
  const requestReport = useRequestReport(patientId);

  const handleRequest = useCallback(() => {
    const period = periodForLastDays(selectedType === "weekly_summary" ? 7 : 30);
    requestReport.mutate(
      { report_type: selectedType, ...period },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.code === "CONSENT_REQUIRED") {
            setNeedsConsent(true);
            return;
          }
          Alert.alert(
            "Erro",
            err instanceof Error ? err.message : "Não foi possível solicitar o relatório.",
          );
        },
      },
    );
  }, [selectedType, requestReport]);

  const handleGrantConsent = useCallback(async () => {
    setGrantingConsent(true);
    try {
      await apiClient.post("/consent", {
        patient_profile_id: patientId,
        consent_type: "ai_analysis",
        consent_text_version: CONSENT_TEXT_VERSION,
      });
      setNeedsConsent(false);
    } catch {
      Alert.alert("Erro", "Não foi possível ativar a análise de IA. Tente novamente.");
    } finally {
      setGrantingConsent(false);
    }
  }, [patientId]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
      accessibilityLabel="Tela de insights e relatórios"
    >
      {/* Disclaimer — must appear before any AI content */}
      <View style={styles.disclaimerBox} accessibilityRole="text">
        <Text
          style={styles.disclaimerText}
          accessibilityLabel="Aviso importante sobre relatórios de IA"
        >
          Este relatório é gerado por análise estatística e não substitui avaliação ou orientação de
          profissional de saúde habilitado.
        </Text>
      </View>

      {/* Consent required — shown after first CONSENT_REQUIRED 403 */}
      {needsConsent && (
        <View style={styles.consentBanner} accessibilityRole="alert">
          <Text style={styles.consentTitle}>Autorização necessária</Text>
          <Text style={styles.consentBody}>
            Para gerar relatórios com análise de IA, é necessário autorizar o processamento de dados
            do paciente para este fim.
          </Text>
          <TouchableOpacity
            style={[styles.consentButton, grantingConsent && styles.buttonDisabled]}
            onPress={() => {
              void handleGrantConsent();
            }}
            disabled={grantingConsent}
            accessibilityRole="button"
            accessibilityLabel="Autorizar análise de IA"
          >
            {grantingConsent ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Autorizar análise</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Request new report */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solicitar Novo Relatório</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {Object.entries(REPORT_TYPE_LABELS).map(([type, label]) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, selectedType === type && styles.typeChipSelected]}
              onPress={() => {
                setSelectedType(type);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedType === type }}
              accessibilityLabel={label}
            >
              <Text
                style={[styles.typeChipText, selectedType === type && styles.typeChipTextSelected]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.button, requestReport.isPending && styles.buttonDisabled]}
          onPress={handleRequest}
          disabled={requestReport.isPending}
          accessibilityRole="button"
          accessibilityLabel="Solicitar relatório de insights"
          accessibilityHint="Gera um relatório de análise para o período selecionado"
        >
          {requestReport.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Solicitar Relatório</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reports list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Relatórios</Text>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} accessibilityLabel="Carregando relatórios" />
        ) : reports?.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum relatório disponível.</Text>
        ) : (
          reports?.map((report) => (
            <TouchableOpacity
              key={report.report_id}
              style={[styles.reportCard, report.is_invalidated && styles.reportCardInvalidated]}
              onPress={() => report.status === "completed" && onSelectReport?.(report.report_id)}
              disabled={report.status !== "completed"}
              accessibilityRole="button"
              accessibilityLabel={`${REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}, ${STATUS_LABELS[report.status] ?? report.status}`}
              accessibilityState={{ disabled: report.status !== "completed" }}
            >
              <View style={styles.reportCardHeader}>
                <Text style={styles.reportType}>
                  {REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[report.status] ?? "#6B7280" },
                  ]}
                  accessibilityRole="text"
                >
                  <Text style={styles.statusBadgeText}>
                    {STATUS_LABELS[report.status] ?? report.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.reportPeriod}>
                {report.period_start} → {report.period_end}
              </Text>
              {report.is_invalidated && (
                <Text style={styles.invalidatedLabel} accessibilityRole="text">
                  Dados de origem alterados — relatório invalidado
                </Text>
              )}
              {report.status === "processing" && (
                <ActivityIndicator style={styles.inlineLoader} size="small" color="#D97706" />
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  disclaimerBox: {
    margin: 16,
    padding: 12,
    backgroundColor: "#FEF9C3",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#EAB308",
  },
  disclaimerText: { fontSize: 13, color: "#713F12", lineHeight: 18 },
  consentBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  consentTitle: { fontSize: 15, fontWeight: "700", color: "#1E40AF", marginBottom: 6 },
  consentBody: { fontSize: 13, color: "#1E40AF", lineHeight: 18, marginBottom: 12 },
  consentButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  section: { margin: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 12 },
  typeRow: { marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    marginRight: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  typeChipSelected: { backgroundColor: "#2563EB" },
  typeChipText: { fontSize: 14, color: "#374151" },
  typeChipTextSelected: { color: "#fff", fontWeight: "600" },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loader: { marginTop: 32 },
  emptyText: { color: "#6B7280", fontSize: 15, textAlign: "center", marginTop: 24 },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardInvalidated: { opacity: 0.65, borderWidth: 1, borderColor: "#FCA5A5" },
  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reportType: { fontSize: 15, fontWeight: "600", color: "#1F2937", flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  reportPeriod: { fontSize: 13, color: "#6B7280" },
  invalidatedLabel: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  inlineLoader: { marginTop: 8 },
});
