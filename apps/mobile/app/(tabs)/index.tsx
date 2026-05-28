import React, { useCallback } from "react";
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

const SEVERITY_COLORS: Record<string, string> = {
  mild: "#D97706",
  moderate: "#EA580C",
  severe: "#DC2626",
  emergency: "#7F1D1D",
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

function SymptomCard({ record, onPress }: { record: SymptomRecord; onPress?: () => void }) {
  const { theme } = useTheme();
  const color = SEVERITY_COLORS[record.severityLevel] ?? theme.colors.text.secondary;
  const isEmergency = record.severityLevel === "emergency" || record.severityLevel === "severe";
  return (
    <TouchableOpacity
      style={[
        styles.symptomCard,
        {
          backgroundColor: isEmergency ? "#FEF2F2" : theme.colors.surface.DEFAULT,
          borderColor: isEmergency ? "#FECACA" : theme.colors.border.DEFAULT,
        },
        theme.shadows.sm,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Sintomas: ${record.symptomCodes.join(", ")}, gravidade ${record.severityLevel}`}
    >
      <View style={styles.symptomRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isEmergency ? "#FEE2E2" : theme.colors.warning.surface },
          ]}
        >
          <Icon name={isEmergency ? "alert-triangle" : "activity"} size="md" color={color} />
        </View>
        <View style={styles.symptomInfo}>
          <View style={styles.topRow}>
            <Text variant="body" style={styles.flex} numberOfLines={1}>
              {record.symptomCodes.length} sintoma{record.symptomCodes.length !== 1 ? "s" : ""}{" "}
              registrado{record.symptomCodes.length !== 1 ? "s" : ""}
            </Text>
            <Badge
              variant="severity"
              severity={record.severityLevel}
              label={
                record.severityLevel === "mild"
                  ? "Leve"
                  : record.severityLevel === "moderate"
                    ? "Moderado"
                    : record.severityLevel === "severe"
                      ? "Grave"
                      : "Emergência"
              }
            />
          </View>
          {record.glucoseReadingMgdl != null && (
            <View style={styles.glucoseRow}>
              <Icon name="droplet" size="xs" color={theme.colors.text.tertiary} />
              <Text variant="bodySm" color={theme.colors.text.secondary}>
                {" "}
                {record.glucoseReadingMgdl} mg/dL
              </Text>
            </View>
          )}
          <Text variant="caption" color={theme.colors.text.tertiary} style={styles.timeText}>
            {formatTime(record.observedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AlertCard({ alert, onPress }: { alert: AlertEvent; onPress?: () => void }) {
  const { theme } = useTheme();
  const isEmergency = alert.severityLevel === "emergency";
  return (
    <TouchableOpacity
      style={[
        styles.alertCard,
        {
          backgroundColor: isEmergency ? "#7F1D1D" : "#FEF2F2",
          borderColor: isEmergency ? "#B91C1C" : "#FECACA",
        },
        theme.shadows.sm,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Alerta: ${ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}${alert.resolvedAt ? ", resolvido" : ", ativo"}`}
    >
      <View style={styles.alertRow}>
        <Icon name="bell" size="md" color={isEmergency ? "#fff" : "#DC2626"} />
        <View style={styles.alertInfo}>
          <Text variant="body" color={isEmergency ? "#fff" : "#DC2626"} numberOfLines={1}>
            {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
          </Text>
          {alert.resolvedAt ? (
            <Text variant="caption" color={isEmergency ? "#FECACA" : theme.colors.text.tertiary}>
              Resolvido às {formatTime(alert.resolvedAt)}
            </Text>
          ) : (
            <Text variant="caption" color={isEmergency ? "#FCA5A5" : "#DC2626"}>
              Ativo — toque para ver orientações
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size="sm" color={isEmergency ? "#FECACA" : "#DC2626"} />
      </View>
    </TouchableOpacity>
  );
}

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

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface.DEFAULT,
            borderBottomColor: theme.colors.border.subtle,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary.surface }]}>
            <Icon name="heart" size="md" color={theme.colors.primary.DEFAULT} />
          </View>
          <View style={styles.headerInfo}>
            <Text variant="h4" numberOfLines={1}>
              {activePatient.fullName}
            </Text>
            <Text variant="caption" color={theme.colors.text.tertiary}>
              Diagnóstico em {activePatient.diagnosisYear}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.colors.primary.DEFAULT }]}
            onPress={() => {
              router.push("/(tabs)/log");
            }}
            accessibilityRole="button"
            accessibilityLabel="Registrar novo evento"
          >
            <Icon name="plus" size="md" color={theme.colors.text.inverse} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={80}
              borderRadius={12}
              style={styles.skeletonItem}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={
            flatItems.length === 0 ? styles.emptyContainer : styles.listContent
          }
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
              message="Registre a primeira insulina ou sintoma para começar o acompanhamento."
            />
          }
          renderItem={({ item }) => {
            if (item.kind === "date-header") {
              return (
                <View style={styles.dateHeader}>
                  <Text
                    variant="caption"
                    color={theme.colors.text.tertiary}
                    style={styles.dateLabel}
                  >
                    {item.date.toUpperCase()}
                  </Text>
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
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: { flex: 1 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1 },
  skeletonContainer: { padding: 16 },
  skeletonItem: { marginBottom: 12 },
  dateHeader: { marginTop: 8, marginBottom: 8 },
  dateLabel: { letterSpacing: 0.5 },
  symptomCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  symptomRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  symptomInfo: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  flex: { flex: 1 },
  glucoseRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  timeText: {},
  alertCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  alertInfo: { flex: 1 },
  footer: { padding: 24, alignItems: "center" },
});
