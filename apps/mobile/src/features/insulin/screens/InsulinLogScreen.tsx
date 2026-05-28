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
import { useForm, Controller, type Resolver } from "react-hook-form";
import { useState } from "react";
import { type z } from "zod";
import { createInsulinRecordSchema } from "@sweetcare/shared-validation";
import { queueInsulinRecord } from "../../../infrastructure/sync/offline-queue.js";

type FormValues = z.infer<typeof createInsulinRecordSchema>;

function zodResolver<T extends z.ZodType>(schema: T): Resolver<z.infer<T>> {
  return ((data: z.infer<T>) => {
    const result = schema.safeParse(data);
    if (result.success) return { values: result.data as z.infer<T>, errors: {} };
    const errors: Record<string, { message: string; type: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (key && !errors[key]) errors[key] = { message: issue.message, type: "validation" };
    }
    return { values: {} as z.infer<T>, errors };
  }) as unknown as Resolver<z.infer<T>>;
}

const DOSE_RATIONALE_OPTIONS = [
  { value: "correction", label: "Correção" },
  { value: "meal_coverage", label: "Refeição" },
  { value: "basal", label: "Basal" },
  { value: "combination", label: "Combinada" },
] as const;

interface Props {
  patientId: string;
  onSuccess?: () => void;
}

export default function InsulinLogScreen({ patientId, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createInsulinRecordSchema),
    defaultValues: {
      client_id: crypto.randomUUID(),
      applied_at: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dose_rationale: "correction",
    },
  });

  const rationale = watch("dose_rationale");

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const result = await queueInsulinRecord(patientId, data);
      if (result.status === "queued") {
        Alert.alert(
          "Salvo offline",
          "Sem conexão. O registro será sincronizado quando você estiver online.",
        );
      }
      onSuccess?.();
    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Registrar Insulina</Text>

      {/* Insulin type */}
      <Text style={styles.label}>Tipo de insulina *</Text>
      <Controller
        control={control}
        name="insulin_type"
        render={({ field }) => (
          <TextInput
            style={[styles.input, errors.insulin_type && styles.inputError]}
            placeholder="Ex: NovoLog, Lantus"
            value={field.value}
            onChangeText={field.onChange}
            accessibilityLabel="Tipo de insulina"
            accessibilityHint="Informe o nome comercial da insulina"
          />
        )}
      />
      {errors.insulin_type && <Text style={styles.error}>{errors.insulin_type.message}</Text>}

      {/* Dose */}
      <Text style={styles.label}>Dose (unidades) *</Text>
      <Controller
        control={control}
        name="dose_units"
        render={({ field }) => (
          <TextInput
            style={[styles.input, errors.dose_units && styles.inputError]}
            placeholder="Ex: 4"
            keyboardType="decimal-pad"
            value={(field.value as number | undefined)?.toString() ?? ""}
            onChangeText={(v) => {
              field.onChange(v ? parseFloat(v) : undefined);
            }}
            accessibilityLabel="Dose em unidades"
          />
        )}
      />
      {errors.dose_units && <Text style={styles.error}>{errors.dose_units.message}</Text>}

      {/* Rationale */}
      <Text style={styles.label}>Tipo de dose *</Text>
      <Controller
        control={control}
        name="dose_rationale"
        render={({ field }) => (
          <View style={styles.chipRow}>
            {DOSE_RATIONALE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, field.value === opt.value && styles.chipSelected]}
                onPress={() => {
                  field.onChange(opt.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: field.value === opt.value }}
                accessibilityLabel={opt.label}
              >
                <Text
                  style={[styles.chipText, field.value === opt.value && styles.chipTextSelected]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Meal carbs — required only for meal_coverage */}
      {rationale === "meal_coverage" && (
        <>
          <Text style={styles.label}>Carboidratos da refeição (g) *</Text>
          <Controller
            control={control}
            name="meal_carbs_grams"
            render={({ field }) => (
              <TextInput
                style={[styles.input, errors.meal_carbs_grams && styles.inputError]}
                placeholder="Ex: 45"
                keyboardType="number-pad"
                value={field.value?.toString() ?? ""}
                onChangeText={(v) => {
                  field.onChange(v ? parseInt(v, 10) : undefined);
                }}
                accessibilityLabel="Carboidratos em gramas"
              />
            )}
          />
          {errors.meal_carbs_grams && (
            <Text style={styles.error}>{errors.meal_carbs_grams.message}</Text>
          )}
        </>
      )}

      {/* Glucose before */}
      <Text style={styles.label}>Glicemia antes (mg/dL)</Text>
      <Controller
        control={control}
        name="glucose_before_mgdl"
        render={({ field }) => (
          <TextInput
            style={[styles.input, errors.glucose_before_mgdl && styles.inputError]}
            placeholder="Ex: 180"
            keyboardType="number-pad"
            value={field.value?.toString() ?? ""}
            onChangeText={(v) => {
              field.onChange(v ? parseInt(v, 10) : undefined);
            }}
            accessibilityLabel="Glicemia antes da aplicação"
          />
        )}
      />
      {errors.glucose_before_mgdl && (
        <Text style={styles.error}>{errors.glucose_before_mgdl.message}</Text>
      )}

      {/* Notes */}
      <Text style={styles.label}>Observações</Text>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Observações opcionais"
            multiline
            numberOfLines={3}
            value={field.value ?? ""}
            onChangeText={field.onChange}
            accessibilityLabel="Observações"
          />
        )}
      />

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={() => {
          void handleSubmit(onSubmit)();
        }}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Registrar aplicação de insulina"
        accessibilityState={{ disabled: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Registrar</Text>
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
  error: { color: "#DC2626", fontSize: 13, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    minHeight: 44,
  },
  chipSelected: { backgroundColor: "#1D4ED8", borderColor: "#1D4ED8" },
  chipText: { fontSize: 15, color: "#374151" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  button: {
    marginTop: 32,
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 56,
  },
  buttonDisabled: { backgroundColor: "#93C5FD" },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
