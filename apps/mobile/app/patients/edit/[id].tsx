import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/design/components/ui/Text.js";
import { Button } from "../../../src/design/components/ui/Button.js";
import { Input } from "../../../src/design/components/ui/Input.js";
import { DatePickerField } from "../../../src/design/components/ui/DatePickerField.js";
import { Divider } from "../../../src/design/components/ui/Divider.js";
import { Icon } from "../../../src/design/components/ui/Icon.js";
import { useTheme } from "../../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../../src/infrastructure/api/client.js";
import type { PatientProfile } from "@sweetcare/shared-types";

interface FormState {
  fullName: string;
  dateOfBirth: string;
  diagnosisYear: string;
  targetMin: string;
  targetMax: string;
  insulinTypeBasal: string;
  insulinTypeBolus: string;
}

interface FieldErrors {
  fullName?: string;
  dateOfBirth?: string;
  diagnosisYear?: string;
  targetMin?: string;
  targetMax?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function validate(f: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!f.fullName.trim()) errs.fullName = "Nome é obrigatório";
  if (!f.dateOfBirth) errs.dateOfBirth = "Selecione a data de nascimento";
  const year = parseInt(f.diagnosisYear, 10);
  if (!f.diagnosisYear || isNaN(year) || year < 1900 || year > CURRENT_YEAR)
    errs.diagnosisYear = "Selecione o ano do diagnóstico";
  const min = parseInt(f.targetMin, 10);
  const max = parseInt(f.targetMax, 10);
  if (isNaN(min) || min < 40 || min > 100) errs.targetMin = "Entre 40 e 100 mg/dL";
  if (isNaN(max) || max < 120 || max > 300) errs.targetMax = "Entre 120 e 300 mg/dL";
  if (!isNaN(min) && !isNaN(max) && max <= min) errs.targetMax = "Deve ser maior que o mínimo";
  return errs;
}

function buildForm(p: PatientProfile): FormState {
  return {
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth,
    diagnosisYear: String(p.diagnosisYear),
    targetMin: String(p.targetGlucoseMinMgdl),
    targetMax: String(p.targetGlucoseMaxMgdl),
    insulinTypeBasal: p.insulinTypeBasal ?? "",
    insulinTypeBolus: p.insulinTypeBolus ?? "",
  };
}

export default function PatientEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { patients, activePatient, setActivePatient, refreshPatients } = useAuth();
  const router = useRouter();

  // Fast path: patient already in context (navigating from Settings)
  const patientInCtx = useMemo(() => patients.find((p) => p.id === id) ?? null, [patients, id]);

  // API fallback: fetch when not in context (deep link, stale context)
  const [remotePt, setRemotePt] = useState<PatientProfile | null>(null);
  const [fetching, setFetching] = useState(!patientInCtx);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (patientInCtx || !id) {
      setFetching(false);
      return;
    }
    let live = true;
    void apiClient
      .get<PatientProfile>(`/patients/${id}`)
      .then((p) => {
        if (live) {
          setRemotePt(p);
          setFetching(false);
        }
      })
      .catch(() => {
        if (live) {
          setFetchFailed(true);
          setFetching(false);
        }
      });
    return () => {
      live = false;
    };
  }, [patientInCtx, id]);

  const patient = patientInCtx ?? remotePt;
  const isActive = activePatient?.id === id;

  // Form — initialized lazily from context (fast path) or synced from API response
  const formInitRef = useRef(!!patientInCtx);
  const [form, setForm] = useState<FormState>(() =>
    patientInCtx
      ? buildForm(patientInCtx)
      : {
          fullName: "",
          dateOfBirth: "",
          diagnosisYear: String(CURRENT_YEAR),
          targetMin: "70",
          targetMax: "180",
          insulinTypeBasal: "",
          insulinTypeBolus: "",
        },
  );

  // Sync form once when API response arrives (fallback path only)
  useEffect(() => {
    if (formInitRef.current || !remotePt) return;
    formInitRef.current = true;
    setForm(buildForm(remotePt));
  }, [remotePt]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  function set(field: keyof FormState) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleSave() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaveError(undefined);
    setSaving(true);
    try {
      await apiClient.patch(`/patients/${id}`, {
        full_name: form.fullName.trim(),
        date_of_birth: form.dateOfBirth,
        diagnosis_year: parseInt(form.diagnosisYear, 10),
        target_glucose_min_mgdl: parseInt(form.targetMin, 10),
        target_glucose_max_mgdl: parseInt(form.targetMax, 10),
        insulin_type_basal: form.insulinTypeBasal.trim() || null,
        insulin_type_bolus: form.insulinTypeBolus.trim() || null,
      });
      await refreshPatients();
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive() {
    if (!patient) return;
    setSettingActive(true);
    try {
      await setActivePatient(patient);
      router.back();
    } finally {
      setSettingActive(false);
    }
  }

  /* ── Loading (API fallback in progress) ─────────────────────────── */
  if (fetching) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
        edges={["bottom"]}
      >
        <Stack.Screen options={{ title: "Editar Paciente", headerShown: true }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Not found ───────────────────────────────────────────────────── */
  if (!patient || fetchFailed) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
        edges={["bottom"]}
      >
        <Stack.Screen options={{ title: "Editar Paciente", headerShown: true }} />
        <View style={styles.center}>
          <Icon name="user-x" size="lg" color={theme.colors.text.tertiary} />
          <Text variant="body" color={theme.colors.text.tertiary} style={styles.notFoundText}>
            Paciente não encontrado.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Form ────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ title: patient.fullName, headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Active patient status */}
          {isActive ? (
            <View
              style={[
                styles.activeBanner,
                {
                  backgroundColor: theme.colors.primary.surface,
                  borderColor: theme.colors.primary.border,
                },
              ]}
            >
              <Icon name="check-circle" size="sm" color={theme.colors.primary.DEFAULT} />
              <Text variant="bodySm" color={theme.colors.primary.dark} style={styles.bannerText}>
                Paciente ativo no momento
              </Text>
            </View>
          ) : (
            <Button
              variant="secondary"
              size="md"
              label={settingActive ? "Definindo..." : "Definir como paciente ativo"}
              onPress={() => {
                void handleSetActive();
              }}
              disabled={settingActive}
              fullWidth
              leftIcon={<Icon name="check-circle" size="sm" color={theme.colors.primary.DEFAULT} />}
              style={styles.setActiveBtn}
              accessibilityLabel="Definir este paciente como ativo em todas as telas"
            />
          )}

          {/* Identification */}
          <Text variant="h4" style={styles.sectionTitle}>
            Dados do paciente
          </Text>

          <Input
            label="Nome completo *"
            value={form.fullName}
            onChangeText={set("fullName")}
            error={errors.fullName}
            autoCapitalize="words"
            accessibilityLabel="Nome completo do paciente"
          />

          <View style={styles.fieldGap}>
            <DatePickerField
              label="Data de nascimento *"
              mode="date"
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
              minimumYear={1920}
              maximumYear={CURRENT_YEAR}
              error={errors.dateOfBirth}
              accessibilityLabel="Data de nascimento do paciente"
            />
          </View>

          <View style={styles.fieldGap}>
            <DatePickerField
              label="Ano do diagnóstico *"
              mode="year"
              value={form.diagnosisYear}
              onChange={set("diagnosisYear")}
              minimumYear={1950}
              maximumYear={CURRENT_YEAR}
              error={errors.diagnosisYear}
              accessibilityLabel="Ano do diagnóstico de diabetes tipo 1"
            />
          </View>

          <Divider style={styles.divider} />

          {/* Glucose targets */}
          <Text variant="h4" style={styles.sectionTitle}>
            Alvos glicêmicos (mg/dL)
          </Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <Input
                label="Mínimo *"
                value={form.targetMin}
                onChangeText={set("targetMin")}
                error={errors.targetMin}
                keyboardType="number-pad"
                accessibilityLabel="Glicemia mínima alvo em mg/dL"
              />
            </View>
            <View style={styles.half}>
              <Input
                label="Máximo *"
                value={form.targetMax}
                onChangeText={set("targetMax")}
                error={errors.targetMax}
                keyboardType="number-pad"
                accessibilityLabel="Glicemia máxima alvo em mg/dL"
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Insulins */}
          <Text variant="h4" style={styles.sectionTitle}>
            Insulinas (opcional)
          </Text>

          <Input
            label="Insulina basal"
            value={form.insulinTypeBasal}
            onChangeText={set("insulinTypeBasal")}
            placeholder="Ex: Lantus, Tresiba"
            placeholderTextColor="#64748B"
            autoCapitalize="words"
            accessibilityLabel="Tipo de insulina basal"
          />

          <Input
            label="Insulina bolus"
            value={form.insulinTypeBolus}
            onChangeText={set("insulinTypeBolus")}
            placeholder="Ex: NovoLog, Humalog"
            placeholderTextColor="#64748B"
            autoCapitalize="words"
            accessibilityLabel="Tipo de insulina bolus"
            style={styles.fieldGap}
          />

          {saveError !== undefined && (
            <Text variant="bodySm" color={theme.colors.error.DEFAULT} style={styles.saveError}>
              {saveError}
            </Text>
          )}

          <Button
            variant="primary"
            size="lg"
            label="Salvar alterações"
            onPress={() => {
              void handleSave();
            }}
            loading={saving}
            disabled={saving}
            fullWidth
            style={styles.btn}
            accessibilityLabel="Salvar alterações do perfil do paciente"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  notFoundText: { marginTop: 4 },

  /* Active / set-active */
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  bannerText: { flex: 1 },
  setActiveBtn: { marginBottom: 24 },

  /* Sections */
  sectionTitle: { marginBottom: 16 },
  fieldGap: { marginTop: 4 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  divider: { marginVertical: 20 },
  saveError: { marginTop: 12, marginBottom: 4 },
  btn: { marginTop: 24 },
});
