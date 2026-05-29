import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/design/components/ui/Text.js";
import { Icon } from "../../../src/design/components/ui/Icon.js";
import { Button } from "../../../src/design/components/ui/Button.js";
import { Divider } from "../../../src/design/components/ui/Divider.js";
import { useTheme } from "../../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../../src/infrastructure/api/client.js";
import type {
  ApiSymptomData,
  ApiSymptomEvent,
  TimelineResponse,
  SuccessSignal,
} from "../../../src/infrastructure/api/timeline.types.js";

/* ── Constants ─────────────────────────────────────────────────────── */
const SYMPTOM_LABELS: Record<string, string> = {
  hypoglycemia_mild: "Hipoglicemia leve",
  tremor: "Tremor",
  confusion: "Confusão",
  loss_of_consciousness: "Perda de consciência",
  seizure: "Convulsão",
  hyperglycemia: "Hiperglicemia",
  ketoacidosis_risk: "Risco de CAD",
  excessive_thirst: "Sede excessiva",
  frequent_urination: "Poliúria",
  fatigue: "Fadiga",
};

const SYMPTOM_EMOJI: Record<string, string> = {
  hypoglycemia_mild: "🍬",
  tremor: "🫨",
  confusion: "🌀",
  loss_of_consciousness: "⚠️",
  seizure: "🚨",
  hyperglycemia: "📈",
  ketoacidosis_risk: "🧪",
  excessive_thirst: "💧",
  frequent_urination: "🚻",
  fatigue: "😴",
};

const DEFAULT_SEVERITY = { label: "Leve", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };

const SEVERITY_INFO: Record<string, { label: string; color: string; bg: string; border: string }> =
  {
    mild: DEFAULT_SEVERITY,
    moderate: { label: "Moderado", color: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
    severe: { label: "Grave", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
    emergency: { label: "Emergência", color: "#7F1D1D", bg: "#FEF2F2", border: "#F87171" },
  };

function glucoseColor(v: number): string {
  if (v < 54) return "#DC2626";
  if (v < 70) return "#EA580C";
  if (v <= 180) return "#16A34A";
  if (v <= 250) return "#D97706";
  return "#DC2626";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── DetailRow ─────────────────────────────────────────────────────── */
function DetailRow({
  icon,
  iconFamily,
  label,
  value,
  valueColor,
}: {
  icon: string;
  iconFamily?: "Feather" | "MaterialCommunityIcons" | "MaterialIcons";
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: theme.colors.surface.subtle }]}>
        <Icon name={icon} family={iconFamily} size="sm" color={theme.colors.text.tertiary} />
      </View>
      <View style={rowStyles.content}>
        <Text variant="caption" color={theme.colors.text.tertiary}>
          {label}
        </Text>
        <Text variant="body" color={valueColor ?? theme.colors.text.primary}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  content: { flex: 1, gap: 2 },
});

/* ── SymptomDetail ─────────────────────────────────────────────────── */
function SymptomDetail({
  record,
  onEdit,
  onDelete,
  deleting,
}: {
  record: ApiSymptomData;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { theme } = useTheme();
  const sev = SEVERITY_INFO[record.severity_level] ?? DEFAULT_SEVERITY;
  const isUrgent = record.severity_level === "emergency" || record.severity_level === "severe";

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: sev.bg, borderBottomColor: sev.border }]}>
        <View style={[styles.heroIconWrap, { backgroundColor: `${sev.color}20` }]}>
          <Icon name={isUrgent ? "alert-triangle" : "activity"} size="lg" color={sev.color} />
        </View>
        <View style={styles.heroCenter}>
          <Text variant="label" style={[styles.heroSubtitle, { color: sev.color }]}>
            Registro de Sintoma
          </Text>
          <Text style={[styles.heroCount, { color: sev.color }]}>
            {record.symptom_codes.length} sintoma
            {record.symptom_codes.length !== 1 ? "s" : ""}
          </Text>
          <View
            style={[
              styles.severityPill,
              { backgroundColor: `${sev.color}18`, borderColor: `${sev.color}30` },
            ]}
          >
            <Text variant="caption" style={{ color: sev.color, fontWeight: "700" }}>
              {sev.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Symptom chips */}
      <View style={styles.section}>
        <Text variant="label" color={theme.colors.text.secondary} style={styles.sectionTitle}>
          Sintomas Registrados
        </Text>
        <View style={styles.chipGrid}>
          {record.symptom_codes.map((code) => (
            <View
              key={code}
              style={[
                styles.symptomChip,
                {
                  backgroundColor: theme.colors.surface.subtle,
                  borderColor: theme.colors.border.DEFAULT,
                },
              ]}
            >
              <Text style={styles.chipEmoji}>{SYMPTOM_EMOJI[code] ?? "🩺"}</Text>
              <Text variant="bodySm" color={theme.colors.text.primary}>
                {SYMPTOM_LABELS[code] ?? code}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Divider />

      {/* Additional data */}
      <View style={styles.section}>
        <Text variant="label" color={theme.colors.text.secondary} style={styles.sectionTitle}>
          Dados Clínicos
        </Text>

        {record.glucose_reading_mgdl != null ? (
          <DetailRow
            icon="droplet"
            label="Glicemia no momento"
            value={`${String(record.glucose_reading_mgdl)} mg/dL`}
            valueColor={glucoseColor(record.glucose_reading_mgdl)}
          />
        ) : (
          <View style={styles.emptyField}>
            <Text variant="caption" color={theme.colors.text.tertiary}>
              Glicemia não informada
            </Text>
          </View>
        )}

        {record.notes != null && record.notes.length > 0 && (
          <>
            <Divider style={styles.rowDivider} />
            <DetailRow icon="file-text" label="Observações" value={record.notes} />
          </>
        )}
      </View>

      <Divider />

      {/* Metadata */}
      <View style={styles.section}>
        <Text variant="label" color={theme.colors.text.secondary} style={styles.sectionTitle}>
          Informações do Registro
        </Text>
        <DetailRow icon="clock" label="Data e hora" value={formatDateTime(record.observed_at)} />
        <Divider style={styles.rowDivider} />
        <DetailRow icon="globe" label="Fuso horário" value={record.timezone} />
      </View>

      <Divider />

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          size="lg"
          label="Editar"
          onPress={onEdit}
          fullWidth
          leftIcon={<Icon name="edit-2" size="sm" color={theme.colors.primary.DEFAULT} />}
          accessibilityLabel="Editar este registro de sintoma"
          style={styles.actionBtn}
        />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Excluir registro de sintoma"
          accessibilityState={{ disabled: deleting }}
        >
          <Icon
            name="trash-2"
            size="sm"
            color={deleting ? theme.colors.text.tertiary : theme.colors.error.DEFAULT}
          />
          <Text
            variant="bodySm"
            color={deleting ? theme.colors.text.tertiary : theme.colors.error.DEFAULT}
            style={styles.deleteBtnText}
          >
            {deleting ? "Excluindo..." : "Excluir registro"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Screen ────────────────────────────────────────────────────────── */
export default function SymptomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const { data: timelineData, isLoading } = useQuery({
    queryKey: ["timeline", activePatient?.id],
    queryFn: () =>
      activePatient
        ? apiClient.get<TimelineResponse>(`/patients/${activePatient.id}/timeline?limit=50`)
        : Promise.resolve<TimelineResponse>({ events: [], next_cursor: null, total_count: 0 }),
    enabled: !!activePatient,
    staleTime: 1000 * 60 * 5,
  });

  const event = timelineData?.events.find(
    (e): e is ApiSymptomEvent => e.type === "symptom" && e.data.record_id === id,
  );

  function handleEdit() {
    router.push({ pathname: "/records/symptom/edit/[id]", params: { id } });
  }

  function handleDelete() {
    if (!activePatient) return;
    Alert.alert(
      "Excluir registro",
      "Tem certeza que deseja excluir este registro de sintoma? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            apiClient
              .delete(`/patients/${activePatient.id}/symptoms/${id}`)
              .then(() => {
                queryClient.setQueryData<SuccessSignal>(["_success_signal"], {
                  type: "delete",
                  ts: Date.now(),
                });
                void queryClient.invalidateQueries({ queryKey: ["timeline", activePatient.id] });
                router.navigate("/");
              })
              .catch((err: unknown) => {
                Alert.alert(
                  "Erro",
                  err instanceof Error ? err.message : "Não foi possível excluir o registro.",
                );
              })
              .finally(() => {
                setDeleting(false);
              });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          title: "Detalhes do Sintoma",
          headerShown: true,
          headerBackTitle: "Início",
        }}
      />

      {isLoading || !event ? (
        <View style={styles.centerState}>
          {isLoading ? (
            <Text variant="body" color={theme.colors.text.tertiary}>
              Carregando...
            </Text>
          ) : (
            <>
              <Text variant="h4" style={{ marginBottom: 8 }}>
                Registro não encontrado
              </Text>
              <Text
                variant="body"
                color={theme.colors.text.tertiary}
                style={{ textAlign: "center", marginBottom: 24 }}
              >
                Volte à tela inicial e tente novamente.
              </Text>
              <Button
                variant="primary"
                label="Voltar"
                onPress={() => {
                  router.back();
                }}
                accessibilityLabel="Voltar para a lista"
              />
            </>
          )}
        </View>
      ) : (
        <SymptomDetail
          record={event.data}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  /* Hero */
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroCenter: { flex: 1 },
  heroSubtitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  heroCount: { fontSize: 28, fontWeight: "700", lineHeight: 34, marginBottom: 8 },
  severityPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  /* Sections */
  scroll: { paddingBottom: 40 },
  section: { paddingHorizontal: 20, paddingVertical: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 4,
    marginTop: 8,
  },
  rowDivider: { marginVertical: 2 },

  /* Symptom chips */
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 15 },

  /* Empty field */
  emptyField: { paddingVertical: 12 },

  /* Actions */
  actions: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, gap: 12 },
  actionBtn: {},
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    minHeight: 44,
  },
  deleteBtnText: { fontWeight: "500" },
});
