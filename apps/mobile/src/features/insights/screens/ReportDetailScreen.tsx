import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../infrastructure/api/client.js";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Chart bar track width: screen - section margins (32) - container padding (32) - label (56) - count (28) - gaps (16)
const CHART_TRACK_WIDTH = Math.max(60, SCREEN_WIDTH - 164);

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

const CONFIDENCE_PCT: Record<string, number> = {
  low: 33,
  medium: 66,
  high: 100,
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_summary: "Resumo Semanal",
  glucose_pattern: "Padrão de Glicemia",
  insulin_effectiveness: "Efetividade da Insulina",
  symptom_trend: "Tendência de Sintomas",
};

// ── Interfaces ────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const prefix = dateStr.slice(0, 10);
  const parts = prefix.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function generateShareText(report: CompletedReport): string {
  const typeLabel = REPORT_TYPE_LABELS[report.report_type] ?? report.report_type;
  const findings = report.content.pattern_findings;

  const findingsText =
    findings.length > 0
      ? findings
          .map(
            (f, i) =>
              `${String(i + 1)}. ${f.finding_type.replace(/_/g, " ")}\n` +
              `   ${f.description}\n` +
              `   Confiança: ${CONFIDENCE_LABELS[f.confidence] ?? f.confidence} | Registros: ${String(f.supporting_data_points)}`,
          )
          .join("\n\n")
      : "Nenhum padrão estatisticamente significativo identificado no período.";

  const sep = "─".repeat(34);
  const dbl = "═".repeat(34);

  const lines: string[] = [
    dbl,
    "RELATÓRIO SWEETCARE",
    dbl,
    "",
    `Tipo: ${typeLabel}`,
    `Período: ${formatDate(report.period_start)} a ${formatDate(report.period_end)}`,
    `Gerado em: ${formatDate(report.generated_at)}`,
    `Modelo de análise: ${report.ai_model_version}`,
    "",
    "⚕️ AVISO MÉDICO IMPORTANTE",
    report.content.disclaimer,
    "",
    sep,
    "RESUMO",
    sep,
    report.content.summary_text,
    "",
    sep,
    `PADRÕES IDENTIFICADOS (${String(findings.length)})`,
    sep,
    findingsText,
    "",
  ];

  if (report.content.confidence_context) {
    lines.push(
      sep,
      "QUALIDADE DOS DADOS",
      sep,
      `Cobertura do período: ${report.content.confidence_context.data_coverage_percent.toFixed(0)}%`,
      "",
    );
  }

  lines.push(
    dbl,
    "Gerado pelo SweetCare",
    "Suporte a cuidadores de crianças com Diabetes Tipo 1",
    dbl,
  );

  return lines.join("\n");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <View
      style={styles.statCard}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${sub ? ` ${sub}` : ""}`}
    >
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ConfidenceBarRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const barWidth = total > 0 ? (count / total) * CHART_TRACK_WIDTH : 0;
  return (
    <View
      style={styles.chartRow}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${String(count)} padrão(s)`}
    >
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={styles.chartBarTrack}>
        <View style={[styles.chartBarFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={styles.chartCount}>{String(count)}</Text>
    </View>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const safe = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${String(safe)}%` as `${number}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function FindingCard({ finding, index }: { finding: PatternFinding; index: number }) {
  const color = CONFIDENCE_COLORS[finding.confidence] ?? "#6B7280";
  const pct = CONFIDENCE_PCT[finding.confidence] ?? 33;
  const label = CONFIDENCE_LABELS[finding.confidence] ?? finding.confidence;

  return (
    <View
      style={styles.findingCard}
      accessibilityRole="text"
      accessibilityLabel={`Padrão ${String(index + 1)}: ${finding.description}. Confiança: ${label}.`}
    >
      <View style={styles.findingHeader}>
        <Text style={styles.findingIndex}>{String(index + 1)}</Text>
        <Text style={styles.findingType} numberOfLines={2}>
          {finding.finding_type.replace(/_/g, " ")}
        </Text>
        <View style={[styles.confidenceBadge, { backgroundColor: color }]}>
          <Text style={styles.confidenceBadgeText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.findingDescription}>{finding.description}</Text>
      <ProgressBar percent={pct} color={color} />
      <Text style={styles.findingSupport}>
        {String(finding.supporting_data_points)} registro(s) analisado(s)
      </Text>
    </View>
  );
}

// ── Data hook ────────────────────────────────────────────────────────────────

function useReportDetail(reportId: string) {
  return useQuery({
    queryKey: ["insight-report", reportId],
    queryFn: (): Promise<ReportDetail> =>
      apiClient.get<ReportDetail>(`/insights/reports/${reportId}`),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 3000 : false),
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReportDetailScreen({ reportId, onBack }: Props) {
  const { data: report, isLoading, error } = useReportDetail(reportId);

  const handleShare = async () => {
    if (!report || report.status !== "completed") return;
    const typeLabel = REPORT_TYPE_LABELS[report.report_type] ?? report.report_type;
    try {
      await Share.share({
        message: generateShareText(report),
        title: `Relatório SweetCare — ${typeLabel}`,
      });
    } catch {
      // user cancelled or share unavailable — silent
    }
  };

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
        <Text style={styles.stateIcon}>⚠️</Text>
        <Text style={styles.errorText} accessibilityRole="alert">
          Não foi possível carregar o relatório.
        </Text>
        {onBack && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Text style={styles.actionButtonText}>Voltar</Text>
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
        {onBack && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonOutline]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para lista de relatórios"
          >
            <Text style={[styles.actionButtonText, styles.actionButtonOutlineText]}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (report.status === "failed") {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateIcon}>❌</Text>
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
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Text style={styles.actionButtonText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Completed report ──────────────────────────────────────────────────────
  const { content } = report;
  const findings = content.pattern_findings;
  const totalFindings = findings.length;
  const highCount = findings.filter((f) => f.confidence === "high").length;
  const mediumCount = findings.filter((f) => f.confidence === "medium").length;
  const lowCount = findings.filter((f) => f.confidence === "low").length;
  const coverage = content.confidence_context?.data_coverage_percent ?? null;
  const coverageColor =
    coverage === null
      ? "#6B7280"
      : coverage >= 70
        ? "#16A34A"
        : coverage >= 40
          ? "#D97706"
          : "#DC2626";

  const periodDays =
    Math.round(
      (new Date(report.period_end).getTime() - new Date(report.period_start).getTime()) /
        86_400_000,
    ) + 1;

  return (
    <ScrollView
      style={styles.container}
      accessibilityLabel="Detalhe do relatório de insights"
      showsVerticalScrollIndicator={false}
    >
      {/* Navigation bar */}
      <View style={styles.navBar}>
        {onBack ? (
          <TouchableOpacity
            style={styles.navBack}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para lista de relatórios"
          >
            <Text style={styles.navBackText}>← Relatórios</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <TouchableOpacity
          style={styles.shareTopButton}
          onPress={() => {
            void handleShare();
          }}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar relatório"
          accessibilityHint="Abre opções para enviar por WhatsApp, e-mail ou outros aplicativos"
        >
          <Text style={styles.shareTopButtonText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer — must appear before any AI content per contract */}
      <View
        style={styles.disclaimerBox}
        accessibilityRole="text"
        accessibilityLabel="Aviso médico importante"
      >
        <Text style={styles.disclaimerTitle}>⚕️ Aviso Médico</Text>
        <Text style={styles.disclaimerText}>{content.disclaimer}</Text>
      </View>

      {report.is_invalidated && (
        <View style={styles.invalidatedBanner} accessibilityRole="alert">
          <Text style={styles.invalidatedText}>
            ⚠️ Os dados de origem foram alterados após a geração deste relatório. As informações
            podem estar desatualizadas.
          </Text>
        </View>
      )}

      {/* Report header */}
      <View style={styles.reportHeader}>
        <Text style={styles.reportTypeLabel}>
          {REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
        </Text>
        <Text style={styles.periodLabel}>
          {formatDate(report.period_start)} → {formatDate(report.period_end)}
        </Text>
        <Text style={styles.metaLabel}>
          Gerado em {formatDate(report.generated_at)} · Modelo {report.ai_model_version}
        </Text>
      </View>

      {/* Statistics grid — 2×2 */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard
            label="Padrões encontrados"
            value={totalFindings === 0 ? "—" : String(totalFindings)}
            valueColor={totalFindings > 0 ? "#2563EB" : "#9CA3AF"}
          />
          <StatCard
            label="Alta confiança"
            value={String(highCount)}
            sub={totalFindings > 0 ? `de ${String(totalFindings)}` : undefined}
            valueColor={highCount > 0 ? "#16A34A" : "#9CA3AF"}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Cobertura do período"
            value={coverage !== null ? `${String(Math.round(coverage))}%` : "—"}
            valueColor={coverageColor}
          />
          <StatCard label="Período analisado" value={String(periodDays)} sub="dias" />
        </View>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText} accessibilityRole="text">
            {content.summary_text}
          </Text>
        </View>
      </View>

      {/* Pattern findings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {totalFindings > 0
            ? `Padrões Identificados (${String(totalFindings)})`
            : "Padrões Identificados"}
        </Text>
        {totalFindings === 0 ? (
          <Text style={styles.emptyFindings} accessibilityRole="text">
            Nenhum padrão estatisticamente significativo foi identificado no período analisado.
            Continue registrando as doses e sintomas para obter análises mais completas.
          </Text>
        ) : (
          findings.map((f, i) => (
            <FindingCard key={`${f.finding_type}-${String(i)}`} finding={f} index={i} />
          ))
        )}
      </View>

      {/* Confidence distribution chart */}
      {totalFindings > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distribuição de Confiança</Text>
          <View style={styles.chartContainer}>
            <ConfidenceBarRow
              label="Alta"
              count={highCount}
              total={totalFindings}
              color={CONFIDENCE_COLORS.high ?? "#16A34A"}
            />
            <ConfidenceBarRow
              label="Média"
              count={mediumCount}
              total={totalFindings}
              color={CONFIDENCE_COLORS.medium ?? "#D97706"}
            />
            <ConfidenceBarRow
              label="Baixa"
              count={lowCount}
              total={totalFindings}
              color={CONFIDENCE_COLORS.low ?? "#DC2626"}
            />
          </View>
          <Text style={styles.chartNote}>
            Padrões com alta confiança são baseados em mais registros e são mais confiáveis para
            discussão com o médico.
          </Text>
        </View>
      )}

      {/* Data quality */}
      {content.confidence_context && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qualidade dos Dados</Text>
          <View style={styles.coverageBox}>
            <View style={styles.coverageHeader}>
              <Text style={styles.coverageLabel}>Cobertura do período</Text>
              <Text style={[styles.coverageValue, { color: coverageColor }]}>
                {String(Math.round(content.confidence_context.data_coverage_percent))}%
              </Text>
            </View>
            <ProgressBar
              percent={content.confidence_context.data_coverage_percent}
              color={coverageColor}
            />
            <Text style={styles.coverageHint}>
              {content.confidence_context.data_coverage_percent >= 70
                ? "Boa cobertura — análise confiável"
                : content.confidence_context.data_coverage_percent >= 40
                  ? "Cobertura moderada — continue registrando"
                  : "Poucos dados — os padrões podem não ser representativos"}
            </Text>
          </View>
          {content.confidence_context.model_limitations.length > 0 && (
            <View style={styles.limitationsBox}>
              <Text style={styles.limitationsTitle}>Limitações desta análise</Text>
              {content.confidence_context.model_limitations.map((lim, i) => (
                <View key={i} style={styles.limitationRow} accessibilityRole="text">
                  <Text style={styles.limitationBullet}>•</Text>
                  <Text style={styles.limitationText}>{lim}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Share / export section */}
      <View style={styles.exportSection}>
        <Text style={styles.exportTitle}>Levar para a consulta médica</Text>
        <Text style={styles.exportSubtitle}>
          Compartilhe este relatório com o médico ou enfermeiro responsável pelo acompanhamento do
          paciente.
        </Text>
        <TouchableOpacity
          style={styles.shareBottomButton}
          onPress={() => {
            void handleShare();
          }}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar relatório"
          accessibilityHint="Abre opções para enviar por WhatsApp, e-mail, imprimir ou salvar"
        >
          <Text style={styles.shareBottomButtonText}>Compartilhar Relatório</Text>
        </TouchableOpacity>
        <Text style={styles.shareHint}>
          Disponível por WhatsApp, e-mail, impressão e outros aplicativos instalados no dispositivo
        </Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  // State screens
  stateIcon: { fontSize: 48, marginBottom: 16 },
  loadingText: { marginTop: 12, fontSize: 15, color: "#6B7280" },
  errorText: { fontSize: 16, color: "#DC2626", textAlign: "center", marginBottom: 16 },
  processingTitle: { fontSize: 18, fontWeight: "600", color: "#92400E", marginTop: 16 },
  processingSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  failedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 8,
    textAlign: "center",
  },
  failedReason: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#2563EB",
  },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  actionButtonOutlineText: { color: "#2563EB" },

  // Navigation bar
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navBack: { minHeight: 44, justifyContent: "center", paddingRight: 16 },
  navBackText: { fontSize: 15, color: "#2563EB", fontWeight: "500" },
  shareTopButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  shareTopButtonText: { fontSize: 14, color: "#2563EB", fontWeight: "600" },

  // Disclaimer
  disclaimerBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: "#FEF9C3",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#EAB308",
  },
  disclaimerTitle: { fontSize: 13, fontWeight: "700", color: "#713F12", marginBottom: 4 },
  disclaimerText: { fontSize: 13, color: "#713F12", lineHeight: 18 },

  // Invalidated banner
  invalidatedBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  invalidatedText: { fontSize: 13, color: "#991B1B", lineHeight: 18 },

  // Report header
  reportHeader: { marginHorizontal: 16, marginBottom: 16 },
  reportTypeLabel: { fontSize: 24, fontWeight: "700", color: "#111827" },
  periodLabel: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  metaLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Statistics grid
  statsGrid: { marginHorizontal: 16, marginBottom: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: "700", color: "#111827" },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  statSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  // Sections
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1F2937", marginBottom: 12 },

  // Summary
  summaryBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryText: { fontSize: 15, color: "#374151", lineHeight: 24 },
  emptyFindings: { fontSize: 14, color: "#6B7280", fontStyle: "italic", lineHeight: 21 },

  // Finding card
  findingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  findingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  findingIndex: { fontSize: 13, fontWeight: "700", color: "#D1D5DB", minWidth: 18 },
  findingType: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textTransform: "capitalize",
    lineHeight: 20,
  },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  confidenceBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  findingDescription: { fontSize: 14, color: "#374151", lineHeight: 21, marginBottom: 10 },
  findingSupport: { fontSize: 12, color: "#9CA3AF", marginTop: 6 },

  // Confidence chart
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  chartLabel: { fontSize: 13, color: "#374151", width: 56, fontWeight: "500" },
  chartBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 5,
    overflow: "hidden",
  },
  chartBarFill: { height: 10, borderRadius: 5 },
  chartCount: { fontSize: 13, color: "#374151", fontWeight: "600", width: 28, textAlign: "right" },
  chartNote: { fontSize: 12, color: "#6B7280", lineHeight: 17, marginTop: 4 },

  // Progress bar (reused in FindingCard + CoverageBox)
  progressTrack: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: { height: 6, borderRadius: 3 },

  // Coverage box
  coverageBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  coverageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  coverageLabel: { fontSize: 14, color: "#374151", fontWeight: "500" },
  coverageValue: { fontSize: 22, fontWeight: "700" },
  coverageHint: { fontSize: 13, color: "#6B7280", marginTop: 8, lineHeight: 18 },

  // Limitations
  limitationsBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  limitationsTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 10 },
  limitationRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  limitationBullet: { fontSize: 16, color: "#D97706", marginRight: 8, lineHeight: 20 },
  limitationText: { fontSize: 13, color: "#6B7280", flex: 1, lineHeight: 19 },

  // Export / share section
  exportSection: {
    marginHorizontal: 16,
    marginTop: 28,
    padding: 20,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    alignItems: "center",
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E40AF",
    textAlign: "center",
    marginBottom: 8,
  },
  exportSubtitle: {
    fontSize: 13,
    color: "#3B82F6",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  shareBottomButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    width: "100%",
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBottomButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  shareHint: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 17,
  },

  bottomSpacer: { height: 40 },
});
