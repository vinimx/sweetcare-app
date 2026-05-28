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
import { tokenStorage } from "../../../infrastructure/storage/secure-storage.js";

const API_BASE =
  (process.env["EXPO_PUBLIC_API_URL"] as string | undefined) ?? "http://localhost:3000/api/v1";

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

async function authedFetch(
  path: string,
  options?: { method?: string; body?: string },
): Promise<Response> {
  const token = await tokenStorage.getAccessToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function useInsightReports(patientId: string) {
  return useQuery({
    queryKey: ["insight-reports", patientId],
    queryFn: async (): Promise<ReportSummary[]> => {
      const res = await authedFetch(`/insights/reports?patient_id=${patientId}`);
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      const data = (await res.json()) as { reports: ReportSummary[] };
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
    mutationFn: async (params: {
      report_type: string;
      period_start: string;
      period_end: string;
    }) => {
      const res = await authedFetch("/insights/reports", {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, ...params }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string; message?: string };
        throw new Error(err.message ?? `HTTP ${String(res.status)}`);
      }
      return (await res.json()) as { report_id: string; status: string };
    },
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
  const { data: reports, isLoading, isRefetching, refetch } = useInsightReports(patientId);
  const requestReport = useRequestReport(patientId);

  const handleRequest = useCallback(() => {
    const period = periodForLastDays(selectedType === "weekly_summary" ? 7 : 30);
    requestReport.mutate(
      { report_type: selectedType, ...period },
      {
        onError: (err) => {
          Alert.alert(
            "Erro",
            err instanceof Error ? err.message : "Não foi possível solicitar o relatório.",
          );
        },
      },
    );
  }, [selectedType, requestReport]);

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
