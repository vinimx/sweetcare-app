import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import type {
  ApiInsulinData,
  ApiSymptomData,
  ApiInsulinEvent,
  ApiSymptomEvent,
  ApiTimelineEvent,
  TimelineResponse,
  SuccessSignal,
} from "../../src/infrastructure/api/timeline.types.js";
import type { InsulinApplicationRecord } from "@sweetcare/shared-types";

/* ── Adapt snake_case API data → DoseCard's InsulinApplicationRecord ─ */
function toInsulinRecord(d: ApiInsulinData): InsulinApplicationRecord {
  return {
    id: d.record_id,
    clientId: d.client_id,
    patientProfileId: "",
    recordedByUserId: "",
    insulinType: d.insulin_type,
    doseUnits: d.dose_units,
    doseRationale: d.dose_rationale,
    mealCarbsGrams: d.meal_carbs_grams,
    glucoseBeforeMgdl: d.glucose_before_mgdl,
    administrationSite: d.administration_site,
    notes: d.notes,
    appliedAt: d.applied_at,
    recordedAt: d.applied_at,
    syncStatus: "synced",
    timezone: d.timezone,
  };
}

const SEVERITY_ACCENT: Record<string, string> = {
  mild: "#D97706",
  moderate: "#EA580C",
  severe: "#DC2626",
  emergency: "#DC2626",
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
function SymptomCard({ record }: { record: ApiSymptomData }) {
  const { theme } = useTheme();
  const accentColor = SEVERITY_ACCENT[record.severity_level] ?? theme.colors.text.secondary;
  const isUrgent = record.severity_level === "emergency" || record.severity_level === "severe";

  const severityLabel =
    record.severity_level === "mild"
      ? "Leve"
      : record.severity_level === "moderate"
        ? "Moderado"
        : record.severity_level === "severe"
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
              {record.symptom_codes.length} sintoma
              {record.symptom_codes.length !== 1 ? "s" : ""} registrado
              {record.symptom_codes.length !== 1 ? "s" : ""}
            </Text>
            <Text variant="caption" color={theme.colors.text.tertiary}>
              {formatTime(record.observed_at)}
            </Text>
          </View>

          <Badge
            variant="severity"
            severity={record.severity_level}
            label={severityLabel}
            size="sm"
          />
        </View>

        {record.glucose_reading_mgdl != null && (
          <View
            style={[
              styles.glucoseChipSmall,
              { backgroundColor: `${accentColor}14`, borderColor: `${accentColor}28` },
            ]}
          >
            <Icon name="droplet" size="xs" color={accentColor} />
            <Text variant="caption" color={accentColor} style={{ fontWeight: "600" }}>
              {" "}
              {record.glucose_reading_mgdl} mg/dL
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ── Timeline types ──────────────────────────────────────────────── */
type FlatItem =
  | { kind: "date-header"; date: string; key: string }
  | { kind: "insulin"; event: ApiInsulinEvent; key: string }
  | { kind: "symptom"; event: ApiSymptomEvent; key: string };

function buildFlatList(events: ApiTimelineEvent[]): FlatItem[] {
  const items: FlatItem[] = [];
  let lastDate = "";
  for (const event of events) {
    const iso = event.type === "insulin" ? event.data.applied_at : event.data.observed_at;
    const dateLabel = formatSectionDate(iso);
    if (dateLabel !== lastDate) {
      lastDate = dateLabel;
      items.push({ kind: "date-header", date: dateLabel, key: `date-${iso}` });
    }
    if (event.type === "insulin") {
      items.push({ kind: "insulin", event, key: `insulin-${event.data.record_id}` });
    } else {
      items.push({ kind: "symptom", event, key: `symptom-${event.data.record_id}` });
    }
  }
  return items;
}

const SUCCESS_MESSAGES: Record<string, string> = {
  insulin: "Insulina registrada com sucesso!",
  symptom: "Sintoma registrado com sucesso!",
  correction: "Correção registrada com sucesso!",
  edit: "Registro atualizado com sucesso!",
  delete: "Registro excluído com sucesso!",
};

/* ── HomeScreen ──────────────────────────────────────────────────── */
export default function HomeScreen() {
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  /* ── Success banner ────────────────────────────────────────────── */
  const { data: successSignal } = useQuery<SuccessSignal | null>({
    queryKey: ["_success_signal"],
    queryFn: () => null,
    staleTime: Infinity,
    gcTime: 10_000,
    initialData: null,
  });
  const lastSignalTs = useRef(0);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (successSignal && successSignal.ts > lastSignalTs.current) {
      lastSignalTs.current = successSignal.ts;
      const msg = SUCCESS_MESSAGES[successSignal.type] ?? "Registro salvo!";
      setBannerText(msg);
      bannerOpacity.setValue(1);
      const t = setTimeout(() => {
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setBannerText(null);
          queryClient.removeQueries({ queryKey: ["_success_signal"] });
        });
      }, 2600);
      return () => {
        clearTimeout(t);
      };
    }
  }, [successSignal, bannerOpacity, queryClient]);

  /* ── Timeline query ────────────────────────────────────────────── */
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
      const iso = ev.type === "insulin" ? ev.data.applied_at : ev.data.observed_at;
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

      {/* ── Success banner ───────────────────────────── */}
      {bannerText && (
        <Animated.View
          style={[
            styles.successBanner,
            { backgroundColor: theme.colors.success.DEFAULT, opacity: bannerOpacity },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Icon name="check-circle" size="sm" color="#fff" />
          <Text variant="bodySm" color="#fff" style={{ fontWeight: "600", flex: 1 }}>
            {bannerText}
          </Text>
        </Animated.View>
      )}

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
              return (
                <DoseCard
                  record={toInsulinRecord(item.event.data)}
                  onPress={() => {
                    router.push({
                      pathname: "/records/insulin/[id]",
                      params: { id: item.event.data.record_id },
                    });
                  }}
                />
              );
            }

            return (
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={() => {
                  router.push({
                    pathname: "/records/symptom/[id]",
                    params: { id: item.event.data.record_id },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="Ver detalhes do registro de sintoma"
              >
                <SymptomCard record={item.event.data} />
              </TouchableOpacity>
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

  /* Success banner */
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  /* Footer */
  footer: { paddingVertical: 24, alignItems: "center" },
});
