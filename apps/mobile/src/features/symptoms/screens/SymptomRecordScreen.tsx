import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState, useMemo } from "react";
import { computeMinimumSeverity } from "@sweetcare/shared-validation";
import type { SymptomCode, SeverityLevel } from "@sweetcare/shared-types";
import { queueSymptomRecord } from "../../../infrastructure/sync/offline-queue.js";
import { apiClient } from "../../../infrastructure/api/client.js";
import { generateUUID } from "../../../infrastructure/utils/uuid.js";

const SYMPTOM_OPTIONS: { code: SymptomCode; label: string; emoji: string }[] = [
  { code: "hypoglycemia_mild", label: "Hipoglicemia leve", emoji: "🍬" },
  { code: "tremor", label: "Tremor", emoji: "🫨" },
  { code: "confusion", label: "Confusão", emoji: "🌀" },
  { code: "loss_of_consciousness", label: "Perda de consciência", emoji: "⚠️" },
  { code: "seizure", label: "Convulsão", emoji: "🚨" },
  { code: "hyperglycemia", label: "Hiperglicemia", emoji: "📈" },
  { code: "ketoacidosis_risk", label: "Risco de CAD", emoji: "🧪" },
  { code: "excessive_thirst", label: "Sede excessiva", emoji: "💧" },
  { code: "frequent_urination", label: "Poliúria", emoji: "🚻" },
  { code: "fatigue", label: "Fadiga", emoji: "😴" },
];

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string; color: string }[] = [
  { value: "mild", label: "Leve", color: "#16A34A" },
  { value: "moderate", label: "Moderado", color: "#D97706" },
  { value: "severe", label: "Grave", color: "#DC2626" },
  { value: "emergency", label: "Emergência", color: "#7F1D1D" },
];

export interface SymptomInitialData {
  selectedCodes?: SymptomCode[];
  severityOverride?: SeverityLevel;
  glucoseReading?: string;
  notes?: string;
}

interface Props {
  patientId: string;
  onSuccess?: () => void;
  initialData?: SymptomInitialData;
  recordId?: string; // When set: update mode (PATCH); absent: create mode (POST)
}

export default function SymptomRecordScreen({
  patientId,
  onSuccess,
  initialData,
  recordId,
}: Props) {
  const isEditMode = !!recordId;
  const [selectedCodes, setSelectedCodes] = useState<SymptomCode[]>(
    initialData?.selectedCodes ?? [],
  );
  const [severityOverride, setSeverityOverride] = useState<SeverityLevel | null>(
    initialData?.severityOverride ?? null,
  );
  const [glucoseReading, setGlucoseReading] = useState(initialData?.glucoseReading ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computedMinSeverity = useMemo(
    () => (selectedCodes.length > 0 ? computeMinimumSeverity(selectedCodes) : null),
    [selectedCodes],
  );

  const effectiveSeverity: SeverityLevel | null = severityOverride ?? computedMinSeverity;

  const toggleSymptom = (code: SymptomCode) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
    setSeverityOverride(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (selectedCodes.length === 0) errs["symptoms"] = "Selecione pelo menos um sintoma.";
    if (!effectiveSeverity) errs["severity"] = "Selecione a gravidade.";
    const glucose = glucoseReading ? parseInt(glucoseReading, 10) : null;
    if (glucose !== null && (glucose < 20 || glucose > 600)) {
      errs["glucose"] = "Glicemia deve estar entre 20 e 600 mg/dL.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !effectiveSeverity) return;
    setSubmitting(true);
    try {
      const glucose = glucoseReading ? parseInt(glucoseReading, 10) : null;

      if (isEditMode) {
        await apiClient.patch(`/patients/${patientId}/symptoms/${recordId}`, {
          symptom_codes: selectedCodes,
          severity_level: effectiveSeverity,
          glucose_reading_mgdl: isNaN(glucose ?? NaN) ? null : glucose,
          notes: notes.trim() || null,
        });
      } else {
        const clientId = generateUUID();
        const result = await queueSymptomRecord(patientId, {
          client_id: clientId,
          symptom_codes: selectedCodes,
          severity_level: effectiveSeverity,
          glucose_reading_mgdl: isNaN(glucose ?? NaN) ? undefined : (glucose ?? undefined),
          notes: notes.trim() || undefined,
          observed_at: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (result.status === "queued") {
          Alert.alert(
            "Salvo offline",
            "Sem conexão. O registro será sincronizado quando você estiver online.",
          );
        }
      }

      setSelectedCodes([]);
      setSeverityOverride(null);
      setGlucoseReading("");
      setNotes("");
      setErrors({});
      onSuccess?.();
    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmergency = effectiveSeverity === "emergency" || effectiveSeverity === "severe";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{isEditMode ? "Editar Sintoma" : "Registrar Sintomas"}</Text>

      {isEmergency && (
        <View style={styles.emergencyBanner} accessibilityRole="alert">
          <Text style={styles.emergencyText}>
            ⚠️ Sintoma grave detectado. Se necessário, acione emergência (SAMU 192).
          </Text>
        </View>
      )}

      {/* Symptom chip grid */}
      <Text style={styles.label}>Sintomas observados *</Text>
      {errors["symptoms"] && <Text style={styles.error}>{errors["symptoms"]}</Text>}
      <View style={styles.chipGrid}>
        {SYMPTOM_OPTIONS.map((opt) => {
          const selected = selectedCodes.includes(opt.code);
          return (
            <TouchableOpacity
              key={opt.code}
              style={[styles.symptomChip, selected && styles.symptomChipSelected]}
              onPress={() => {
                toggleSymptom(opt.code);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={opt.label}
            >
              <Text style={styles.symptomEmoji}>{opt.emoji}</Text>
              <Text style={[styles.symptomLabel, selected && styles.symptomLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Severity selector */}
      <Text style={styles.label}>Gravidade *</Text>
      {computedMinSeverity && (
        <Text style={styles.hint}>
          Mínimo recomendado pelos sintomas:{" "}
          <Text style={styles.hintBold}>
            {SEVERITY_OPTIONS.find((s) => s.value === computedMinSeverity)?.label}
          </Text>
        </Text>
      )}
      {errors["severity"] && <Text style={styles.error}>{errors["severity"]}</Text>}
      <View style={styles.chipRow}>
        {SEVERITY_OPTIONS.map((opt) => {
          const selected = effectiveSeverity === opt.value;
          const disabled =
            computedMinSeverity !== null &&
            SEVERITY_OPTIONS.findIndex((s) => s.value === opt.value) <
              SEVERITY_OPTIONS.findIndex((s) => s.value === computedMinSeverity);

          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.severityChip,
                selected && { backgroundColor: opt.color, borderColor: opt.color },
                disabled && styles.chipDisabled,
              ]}
              onPress={() => {
                if (!disabled) setSeverityOverride(opt.value);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.severityText, selected && styles.severityTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Glucose reading */}
      <Text style={styles.label}>Glicemia atual (mg/dL)</Text>
      <TextInput
        style={[styles.input, errors["glucose"] && styles.inputError]}
        placeholder="Ex: 65"
        placeholderTextColor="#64748B"
        keyboardType="number-pad"
        value={glucoseReading}
        onChangeText={setGlucoseReading}
        accessibilityLabel="Glicemia atual em mg/dL"
      />
      {errors["glucose"] && <Text style={styles.error}>{errors["glucose"]}</Text>}

      {/* Notes */}
      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Observações opcionais"
        placeholderTextColor="#64748B"
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        accessibilityLabel="Observações adicionais"
      />

      <TouchableOpacity
        style={[
          styles.button,
          isEmergency && styles.buttonEmergency,
          submitting && styles.buttonDisabled,
        ]}
        onPress={() => {
          void handleSubmit();
        }}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={isEditMode ? "Salvar alterações" : "Registrar sintomas"}
        accessibilityState={{ disabled: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isEditMode ? "Salvar Alterações" : "Registrar"}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 24 },
  label: { fontSize: 16, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 16 },
  hint: { fontSize: 13, color: "#6B7280", marginBottom: 6 },
  hintBold: { fontWeight: "700", color: "#374151" },
  error: { color: "#DC2626", fontSize: 13, marginBottom: 4 },
  emergencyBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  emergencyText: { color: "#991B1B", fontSize: 16, fontWeight: "600", lineHeight: 22 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    minHeight: 44,
  },
  symptomChipSelected: { backgroundColor: "#EFF6FF", borderColor: "#1D4ED8" },
  symptomEmoji: { fontSize: 16 },
  symptomLabel: { fontSize: 14, color: "#374151" },
  symptomLabelSelected: { color: "#1D4ED8", fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  severityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    minHeight: 44,
  },
  chipDisabled: { opacity: 0.35 },
  severityText: { fontSize: 15, color: "#374151" },
  severityTextSelected: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  inputError: { borderColor: "#DC2626" },
  textArea: { height: 80, textAlignVertical: "top" },
  button: {
    marginTop: 32,
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 56,
  },
  buttonEmergency: { backgroundColor: "#DC2626" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
