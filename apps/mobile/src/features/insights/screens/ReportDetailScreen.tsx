import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { tokenStorage } from "../../../infrastructure/storage/secure-storage.js";

const API_BASE = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3000/api/v1";

const CONFIDENCE_COLORS: Record<string, string> = {
  low: "#DC2626",
  medium: "#D97706",
  high: "#16A34A",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_summary: "Resumo Semanal",
  glucose_pattern: "Padrão de Glicemia",
  insulin_effectiveness: "Efetividade da Insulina",
  symptom_trend: "Tendência de Sintomas",
};

interface PatternFinding {
  finding_type: string;
  description: string;
  supporting_data_points: number;
  confidence: "low" | "medium" | "high";
}

interface ConfidenceContext {
  data_coverage_percent: number;
  model_limitations: string[];
}

interface CompletedReport {
  report_id: string;
  status: "completed";
  report_type: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  ai_model_version: string;
  is_invalidated: boolean;
  content: {
    summary_text: string;
    pattern_findings: PatternFinding[];
    confidence_context: ConfidenceContext | null;
    disclaimer: string;
  };
}

interface ProcessingReport {
  report_id: string;
  status: "processing";
  progress_percent: number | null;
}

interface FailedReport {
  report_id: string;
  status: "failed";
  error_code: string;
  retry_allowed: boolean;
}

type ReportDetail = CompletedReport | ProcessingReport | FailedReport;

interface Props {
  reportId: string;
  onBack?: () => void;
}

async function authedFetch(path: string): Promise<Response> {
  const token = await tokenStorage.getAccessToken();
  return fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function useReportDetail(reportId: string) {
  return useQuery({
    queryKey: ["insight-report", reportId],
    queryFn: async (): Promise<ReportDetail> => {
      const res = await authedFetch(`/insights/reports/${reportId}`);
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return res.json() as Promise<ReportDetail>;
    },
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 3000 : false),
  });
}

function FindingCard({ finding }: { finding: PatternFinding }) {
  return (
    <View
      style={styles.findingCard}
      accessibilityRole="text"
      accessibilityLabel={`Padrão: ${finding.description}. Confiança: ${CONFIDENCE_LABELS[finding.confidence] ?? finding.confidence}. Pontos de dados: ${String(finding.supporting_data_points)}`}
    >
      <View style={styles.findingHeader}>
        <Text style={styles.findingType}>{finding.finding_type.replace(/_/g, " ")}</Text>
        <View
          style={[
            styles.confidenceBadge,
            { backgroundColor: CONFIDENCE_COLORS[finding.confidence] ?? "#6B7280" },
          ]}
        >
          <Text style={styles.confidenceBadgeText}>
            {CONFIDENCE_LABELS[finding.confidence] ?? finding.confidence}
          </Text>
        </View>
      </View>
      <Text style={styles.findingDescription}>{finding.description}</Text>
      <Text style={styles.findingSupport}>
        {finding.supporting_data_points} registro(s) de suporte
      </Text>
    </View>
  );
}

export default function ReportDetailScreen({ reportId, onBack }: Props) {
  const { data: report, isLoading, error } = useReportDetail(reportId);

  if (isLoading) {
    return (
      <View style={styles.centered} accessibilityLabel="Carregando relatório">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          Não foi possível carregar o relatório.
        </Text>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button">
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (report.status === "processing") {
    return (
      <View style={styles.centered} accessibilityLabel="Relatório em processamento">
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.processingTitle}>Gerando relatório...</Text>
        <Text style={styles.processingSubtitle}>
          A análise estatística pode levar alguns segundos.
        </Text>
      </View>
    );
  }

  if (report.status === "failed") {
    return (
      <View style={styles.centered}>
        <Text style={styles.failedTitle} accessibilityRole="alert">
          Relatório não disponível
        </Text>
        <Text style={styles.failedReason}>
          {report.error_code === "INSUFFICIENT_DATA"
            ? "Dados insuficientes no período selecionado (mínimo 3 registros de insulina)."
            : report.error_code === "TIMEOUT"
              ? "A análise excedeu o tempo limite. Tente novamente."
              : "Ocorreu um erro durante a análise."}
        </Text>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button">
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const { content } = report;

  return (
    <ScrollView style={styles.container} accessibilityLabel="Detalhe do relatório de insights">
      {onBack && (
        <TouchableOpacity style={styles.backLink} onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>
      )}

      {/* Disclaimer — MUST appear before AI content per contract */}
      <View
        style={styles.disclaimerBox}
        accessibilityRole="text"
        accessibilityLabel="Aviso importante"
      >
        <Text style={styles.disclaimerTitle}>Aviso Importante</Text>
        <Text style={styles.disclaimerText}>{content.disclaimer}</Text>
      </View>

      {report.is_invalidated && (
        <View style={styles.invalidatedBanner} accessibilityRole="alert">
          <Text style={styles.invalidatedText}>
            Os dados de origem foram alterados após a geração deste relatório. As informações podem
            estar desatualizadas.
          </Text>
        </View>
      )}

      {/* Report header */}
      <View style={styles.header}>
        <Text style={styles.reportTypeLabel}>
          {REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
        </Text>
        <Text style={styles.periodLabel}>
          {report.period_start} → {report.period_end}
        </Text>
        <Text style={styles.metaLabel}>
          Modelo: {report.ai_model_version} · Gerado em{" "}
          {new Date(report.generated_at).toLocaleDateString("pt-BR")}
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <Text style={styles.summaryText} accessibilityRole="text">
          {content.summary_text}
        </Text>
      </View>

      {/* Pattern findings */}
      {content.pattern_findings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Padrões Identificados</Text>
          {content.pattern_findings.map((f, i) => (
            <FindingCard key={`${f.finding_type}-${String(i)}`} finding={f} />
          ))}
        </View>
      )}

      {content.pattern_findings.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.emptyFindings} accessibilityRole="text">
            Nenhum padrão estatisticamente significativo foi identificado no período.
          </Text>
        </View>
      )}

      {/* Confidence context */}
      {content.confidence_context && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qualidade dos Dados</Text>
          <View style={styles.coverageRow}>
            <Text style={styles.coverageLabel}>Cobertura do período</Text>
            <Text style={styles.coverageValue}>
              {content.confidence_context.data_coverage_percent.toFixed(0)}%
            </Text>
          </View>
          {content.confidence_context.model_limitations.map((lim, i) => (
            <View key={i} style={styles.limitationRow} accessibilityRole="text">
              <Text style={styles.limitationBullet}>⚠</Text>
              <Text style={styles.limitationText}>{lim}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: "#6B7280" },
  errorText: { fontSize: 16, color: "#DC2626", textAlign: "center", marginBottom: 16 },
  processingTitle: { fontSize: 18, fontWeight: "600", color: "#92400E", marginTop: 16 },
  processingSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 8, textAlign: "center" },
  failedTitle: { fontSize: 18, fontWeight: "600", color: "#DC2626", marginBottom: 8 },
  failedReason: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 16 },
  backButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  backButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  backLink: { paddingHorizontal: 16, paddingTop: 16, minHeight: 44, justifyContent: "center" },
  backLinkText: { fontSize: 15, color: "#2563EB", fontWeight: "500" },
  disclaimerBox: {
    margin: 16,
    padding: 14,
    backgroundColor: "#FEF9C3",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#EAB308",
  },
  disclaimerTitle: { fontSize: 13, fontWeight: "700", color: "#713F12", marginBottom: 4 },
  disclaimerText: { fontSize: 13, color: "#713F12", lineHeight: 18 },
  invalidatedBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  invalidatedText: { fontSize: 13, color: "#991B1B" },
  header: { marginHorizontal: 16, marginBottom: 8 },
  reportTypeLabel: { fontSize: 22, fontWeight: "700", color: "#111827" },
  periodLabel: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  metaLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", marginBottom: 10 },
  summaryText: { fontSize: 15, color: "#374151", lineHeight: 22 },
  emptyFindings: { fontSize: 14, color: "#6B7280", fontStyle: "italic" },
  findingCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  findingType: { fontSize: 14, fontWeight: "600", color: "#1F2937", flex: 1, marginRight: 8 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  confidenceBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  findingDescription: { fontSize: 14, color: "#374151", lineHeight: 20 },
  findingSupport: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  coverageRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  coverageLabel: { fontSize: 14, color: "#374151" },
  coverageValue: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  limitationRow: { flexDirection: "row", marginBottom: 6 },
  limitationBullet: { fontSize: 13, color: "#D97706", marginRight: 6 },
  limitationText: { fontSize: 13, color: "#6B7280", flex: 1, lineHeight: 18 },
  bottomSpacer: { height: 40 },
});
