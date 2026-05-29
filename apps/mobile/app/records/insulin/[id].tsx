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
  ApiInsulinData,
  ApiInsulinEvent,
  TimelineResponse,
  SuccessSignal,
} from "../../../src/infrastructure/api/timeline.types.js";

/* ── Constants ─────────────────────────────────────────────────────── */
const DOSE_RATIONALE_LABELS: Record<string, string> = {
  correction: "Correção",
  meal_coverage: "Refeição",
  basal: "Basal",
  combination: "Combinada",
};

const RATIONALE_ACCENT: Record<string, string> = {
  meal_coverage: "#16A34A",
  correction: "#D97706",
  basal: "#2563EB",
  combination: "#7C3AED",
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

/* ── InsulinDetail ─────────────────────────────────────────────────── */
function InsulinDetail({
  record,
  onEdit,
  onDelete,
  deleting,
}: {
  record: ApiInsulinData;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { theme } = useTheme();
  const accentColor = RATIONALE_ACCENT[record.dose_rationale] ?? theme.colors.primary.DEFAULT;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: `${accentColor}0D` }]}>
        <View style={[styles.heroIconWrap, { backgroundColor: `${accentColor}18` }]}>
          <Icon name="syringe" family="MaterialCommunityIcons" size="lg" color={accentColor} />
        </View>
        <View style={styles.heroCenter}>
          <Text variant="label" color={theme.colors.text.tertiary} style={styles.heroSubtitle}>
            Aplicação de Insulina
          </Text>
          <View style={styles.heroDoseRow}>
            <Text variant="numeric" style={[styles.heroDose, { color: theme.colors.text.primary }]}>
              {record.dose_units.toFixed(2)}
            </Text>
            <Text variant="unit" color={theme.colors.text.secondary} style={styles.heroUnit}>
              U
            </Text>
          </View>
          <View
            style={[
              styles.rationalePill,
              { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` },
            ]}
          >
            <Text variant="caption" style={{ color: accentColor, fontWeight: "700" }}>
              {DOSE_RATIONALE_LABELS[record.dose_rationale] ?? record.dose_rationale}
            </Text>
          </View>
        </View>
      </View>

      {/* Record details */}
      <View style={styles.section}>
        <Text variant="label" color={theme.colors.text.secondary} style={styles.sectionTitle}>
          Dados do Registro
        </Text>

        <DetailRow
          icon="syringe"
          iconFamily="MaterialCommunityIcons"
          label="Tipo de insulina"
          value={record.insulin_type}
        />

        {record.glucose_before_mgdl != null && (
          <>
            <Divider style={styles.rowDivider} />
            <DetailRow
              icon="droplet"
              label="Glicemia antes"
              value={`${String(record.glucose_before_mgdl)} mg/dL`}
              valueColor={glucoseColor(record.glucose_before_mgdl)}
            />
          </>
        )}

        {record.meal_carbs_grams != null && (
          <>
            <Divider style={styles.rowDivider} />
            <DetailRow
              icon="coffee"
              label="Carboidratos da refeição"
              value={`${String(record.meal_carbs_grams)} g`}
            />
          </>
        )}

        {record.administration_site != null && record.administration_site.length > 0 && (
          <>
            <Divider style={styles.rowDivider} />
            <DetailRow
              icon="map-pin"
              label="Local de aplicação"
              value={record.administration_site}
            />
          </>
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
        <DetailRow icon="clock" label="Data e hora" value={formatDateTime(record.applied_at)} />
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
          accessibilityLabel="Editar este registro de insulina"
          style={styles.actionBtn}
        />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Excluir registro de insulina"
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
export default function InsulinDetailScreen() {
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
    (e): e is ApiInsulinEvent => e.type === "insulin" && e.data.record_id === id,
  );

  function handleEdit() {
    router.push({ pathname: "/records/insulin/edit/[id]", params: { id } });
  }

  function handleDelete() {
    if (!activePatient) return;
    Alert.alert(
      "Excluir registro",
      "Tem certeza que deseja excluir este registro de insulina? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            apiClient
              .delete(`/patients/${activePatient.id}/insulin-records/${id}`)
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
          title: "Detalhes da Insulina",
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
        <InsulinDetail
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

  /* Loading / not found */
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
  heroSubtitle: { marginBottom: 4, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  heroDoseRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 8 },
  heroDose: { fontSize: 40, fontWeight: "700", lineHeight: 44 },
  heroUnit: { fontSize: 18, fontWeight: "500" },
  rationalePill: {
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
