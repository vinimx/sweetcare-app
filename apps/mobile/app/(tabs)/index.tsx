import React, { useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Badge } from "../../src/design/components/ui/Badge.js";
import { EmptyState } from "../../src/design/components/ui/EmptyState.js";
import { Skeleton } from "../../src/design/components/ui/Skeleton.js";
import { DoseCard } from "../../src/design/components/domain/DoseCard.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../src/infrastructure/api/client.js";
import type { TimelineEvent, SymptomRecord, AlertEvent } from "@sweetcare/shared-types";

interface TimelineResponse {
  events: TimelineEvent[];
  next_cursor: string | null;
  total_count: number;
}

const SEVERITY_ACCENT: Record<string, string> = {
  mild: "#D97706",
  moderate: "#EA580C",
  severe: "#DC2626",
  emergency: "#DC2626",
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  hypoglycemia_risk: "Risco de Hipoglicemia",
  severe_hypoglycemia: "Hipoglicemia Grave",
  ketoacidosis_risk: "Risco de Cetoacidose",
  emergency_response_required: "Emergência",
};

function formatSectionDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* ── SymptomCard ─────────────────────────────────────────────────── */
function SymptomCard({ record }: { record: SymptomRecord }) {
  const { theme } = useTheme();
  const accentColor = SEVERITY_ACCENT[record.severityLevel] ?? theme.colors.text.secondary;
  const isUrgent = record.severityLevel === "emergency" || record.severityLevel === "severe";

  const severityLabel =
    record.severityLevel === "mild"
      ? "Leve"
      : record.severityLevel === "moderate"
        ? "Moderado"
        : record.severityLevel === "severe"
          ? "Grave"
          : "Emergência";

  return (
    <View
      style={[
        styles.accentCard,
        {
          backgroundColor: isUrgent ? "#FEF2F2" : theme.colors.surface.DEFAULT,
          borderColor: isUrgent ? "#FECACA" : "rgba(148,163,184,0.15)",
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="none"
    >
      {/* Left accent */}
      <View style={[styles.leftBar, { backgroundColor: accentColor }]} />

      <View style={styles.accentContent}>
        <View style={styles.accentTopRow}>
          <View style={[styles.accentIcon, { backgroundColor: `${accentColor}18` }]}>
            <Icon name={isUrgent ? "alert-triangle" : "activity"} size="md" color={accentColor} />
          </View>

          <View style={styles.accentNameBlock}>
            <Text
              variant="label"
              style={{ fontWeight: "600", fontSize: 15, color: isUrgent ? "#991B1B" : "#0F172A" }}
              numberOfLines={1}
            >
              {record.symptomCodes.length} sintoma
              {record.symptomCodes.length !== 1 ? "s" : ""} registrado
              {record.symptomCodes.length !== 1 ? "s" : ""}
            </Text>
            <Text variant="caption" color={theme.colors.text.tertiary}>
              {formatTime(record.observedAt)}
            </Text>
          </View>

          <Badge
            variant="severity"
            severity={record.severityLevel}
            label={severityLabel}
            size="sm"
          />
        </View>

        {record.glucoseReadingMgdl != null && (
          <View
            style={[
              styles.glucoseChipSmall,
              { backgroundColor: `${accentColor}14`, borderColor: `${accentColor}28` },
            ]}
          >
            <Icon name="droplet" size="xs" color={accentColor} />
            <Text variant="caption" color={accentColor} style={{ fontWeight: "600" }}>
              {" "}
              {record.glucoseReadingMgdl} mg/dL
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ── AlertCard ───────────────────────────────────────────────────── */
function AlertCard({ alert, onPress }: { alert: AlertEvent; onPress?: () => void }) {
  const { theme } = useTheme();
  const isEmergency = alert.severityLevel === "emergency";
  const isCritical = alert.severityLevel === "critical" || isEmergency;

  const bg = isEmergency ? "#7F1D1D" : isCritical ? "#FEF2F2" : theme.colors.surface.DEFAULT;
  const border = isEmergency ? "#991B1B" : isCritical ? "#FECACA" : "rgba(148,163,184,0.15)";
  const iconColor = isEmergency ? "#fff" : "#DC2626";
  const titleColor = isEmergency ? "#fff" : "#DC2626";
  const subColor = isEmergency ? "#FECACA" : theme.colors.text.tertiary;

  return (
    <TouchableOpacity
      style={[styles.alertCard, { backgroundColor: bg, borderColor: border }, theme.shadows.sm]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Alerta: ${ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}${alert.resolvedAt ? ", resolvido" : ", ativo"}`}
    >
      <View
        style={[
          styles.alertIconWrap,
          { backgroundColor: isEmergency ? "rgba(255,255,255,0.15)" : "#FEE2E2" },
        ]}
      >
        <Icon name={isEmergency ? "zap" : "alert-triangle"} size="md" color={iconColor} />
      </View>

      <View style={styles.alertBody}>
        <Text
          variant="label"
          color={titleColor}
          style={{ fontWeight: "600", fontSize: 15 }}
          numberOfLines={1}
        >
          {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
        </Text>
        {alert.resolvedAt ? (
          <Text variant="caption" color={subColor}>
            Resolvido às {formatTime(alert.resolvedAt)}
          </Text>
        ) : (
          <Text variant="caption" color={subColor}>
            {isEmergency
              ? "Protocolo de emergência disponível"
              : "Ativo — toque para ver orientações"}
          </Text>
        )}
      </View>

      <Icon
        name="chevron-right"
        size="sm"
        color={isEmergency ? "rgba(255,255,255,0.6)" : "#DC2626"}
      />
    </TouchableOpacity>
  );
}

/* ── Timeline types ──────────────────────────────────────────────── */
type FlatItem =
  | { kind: "date-header"; date: string; key: string }
  | { kind: "insulin"; event: TimelineEvent & { type: "insulin" }; key: string }
  | { kind: "symptom"; event: TimelineEvent & { type: "symptom" }; key: string }
  | { kind: "alert"; event: TimelineEvent & { type: "alert" }; key: string };

function buildFlatList(events: TimelineEvent[]): FlatItem[] {
  const items: FlatItem[] = [];
  let lastDate = "";
  for (const event of events) {
    const iso =
      event.type === "insulin"
        ? event.data.appliedAt
        : event.type === "symptom"
          ? event.data.observedAt
          : event.data.createdAt;
    const dateLabel = formatSectionDate(iso);
    if (dateLabel !== lastDate) {
      lastDate = dateLabel;
      items.push({ kind: "date-header", date: dateLabel, key: `date-${iso}` });
    }
    items.push({ kind: event.type, event: event as never, key: `${event.type}-${event.data.id}` });
  }
  return items;
}

/* ── HomeScreen ──────────────────────────────────────────────────── */
export default function HomeScreen() {
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["timeline", activePatient?.id],
    queryFn: () =>
      activePatient
        ? apiClient.get<TimelineResponse>(`/patients/${activePatient.id}/timeline?limit=50`)
        : Promise.resolve<TimelineResponse>({ events: [], next_cursor: null, total_count: 0 }),
    enabled: !!activePatient,
  });

  const todayCount = useMemo(() => {
    if (!data?.events.length) return 0;
    const today = new Date().toDateString();
    return data.events.filter((ev) => {
      const iso =
        ev.type === "insulin"
          ? ev.data.appliedAt
          : ev.type === "symptom"
            ? ev.data.observedAt
            : ev.data.createdAt;
      return new Date(iso).toDateString() === today;
    }).length;
  }, [data?.events]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  /* No patient */
  if (!activePatient) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <EmptyState
          variant="noPatient"
          title="Nenhum paciente selecionado"
          message="Adicione o perfil do paciente para começar o acompanhamento."
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

  const flatItems = buildFlatList(data?.events ?? []);
  const initials = getInitials(activePatient.fullName);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      {/* ── Patient header ───────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface.DEFAULT,
            borderBottomColor: theme.colors.border.subtle,
          },
        ]}
      >
        <View style={styles.headerRow}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary.surface }]}>
            <Text
              variant="label"
              color={theme.colors.primary.DEFAULT}
              style={{ fontWeight: "700", fontSize: 16 }}
            >
              {initials}
            </Text>
          </View>

          {/* Patient info */}
          <View style={styles.patientInfo}>
            <Text variant="h4" numberOfLines={1} style={{ letterSpacing: -0.2 }}>
              {activePatient.fullName}
            </Text>
            <View style={styles.patientMeta}>
              <Text variant="caption" color={theme.colors.text.tertiary}>
                T1DM · {activePatient.diagnosisYear}
              </Text>
              {todayCount > 0 && (
                <>
                  <View style={[styles.metaDot, { backgroundColor: theme.colors.text.tertiary }]} />
                  <Text
                    variant="caption"
                    color={theme.colors.primary.DEFAULT}
                    style={{ fontWeight: "600" }}
                  >
                    {todayCount} hoje
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Add button */}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.colors.primary.DEFAULT }]}
            onPress={() => {
              router.push("/(tabs)/log");
            }}
            accessibilityRole="button"
            accessibilityLabel="Registrar novo evento"
          >
            <Icon name="plus" size="md" color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Timeline ─────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.skeletons}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={82}
              borderRadius={16}
              style={styles.skeletonItem}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={flatItems.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary.DEFAULT}
            />
          }
          ListEmptyComponent={
            <EmptyState
              variant="noRecords"
              title="Sem registros ainda"
              message="Registre a primeira insulina ou sintoma para iniciar o acompanhamento."
            />
          }
          renderItem={({ item }) => {
            /* ── Date section header ───────────────── */
            if (item.kind === "date-header") {
              return (
                <View style={styles.dateHeader}>
                  <View
                    style={[styles.dateLine, { backgroundColor: theme.colors.border.subtle }]}
                  />
                  <View
                    style={[
                      styles.datePill,
                      {
                        backgroundColor: theme.colors.surface.subtle,
                        borderColor: theme.colors.border.DEFAULT,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={theme.colors.text.secondary}
                      style={styles.dateText}
                    >
                      {item.date}
                    </Text>
                  </View>
                  <View
                    style={[styles.dateLine, { backgroundColor: theme.colors.border.subtle }]}
                  />
                </View>
              );
            }

            if (item.kind === "insulin") {
              return <DoseCard record={item.event.data} />;
            }

            if (item.kind === "symptom") {
              return <SymptomCard record={item.event.data} />;
            }

            return (
              <AlertCard
                alert={item.event.data}
                onPress={() => {
                  router.push(`/alerts/${item.event.data.id}`);
                }}
              />
            );
          }}
          ListFooterComponent={
            data && data.total_count > data.events.length ? (
              <View style={styles.footer}>
                <ActivityIndicator color={theme.colors.primary.DEFAULT} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Header */
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  patientInfo: { flex: 1 },
  patientMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  emptyWrap: { flex: 1 },
  skeletons: { paddingHorizontal: 16, paddingTop: 12 },
  skeletonItem: { marginBottom: 10 },

  /* Date header */
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  dateLine: { flex: 1, height: 1 },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: 10,
  },
  dateText: { fontWeight: "500", letterSpacing: 0.3 },

  /* SymptomCard */
  accentCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  leftBar: { width: 4 },
  accentContent: { flex: 1, padding: 14 },
  accentTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  accentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  accentNameBlock: { flex: 1, justifyContent: "center", gap: 2 },
  glucoseChipSmall: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },

  /* AlertCard */
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  alertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertBody: { flex: 1, gap: 2 },

  /* Footer */
  footer: { paddingVertical: 24, alignItems: "center" },
});
