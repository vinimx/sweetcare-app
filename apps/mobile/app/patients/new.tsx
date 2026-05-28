import React, { useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Input } from "../../src/design/components/ui/Input.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { Divider } from "../../src/design/components/ui/Divider.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../src/infrastructure/api/client.js";
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

const DEFAULTS: FormState = {
  fullName: "",
  dateOfBirth: "",
  diagnosisYear: String(new Date().getFullYear()),
  targetMin: "70",
  targetMax: "180",
  insulinTypeBasal: "",
  insulinTypeBolus: "",
};

interface FieldErrors {
  fullName?: string;
  dateOfBirth?: string;
  diagnosisYear?: string;
  targetMin?: string;
  targetMax?: string;
}

function validate(f: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!f.fullName.trim()) errs.fullName = "Nome é obrigatório";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateOfBirth)) errs.dateOfBirth = "Use o formato AAAA-MM-DD";
  const year = parseInt(f.diagnosisYear, 10);
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear())
    errs.diagnosisYear = "Ano inválido";
  const min = parseInt(f.targetMin, 10);
  const max = parseInt(f.targetMax, 10);
  if (isNaN(min) || min < 40 || min > 100) errs.targetMin = "Entre 40 e 100 mg/dL";
  if (isNaN(max) || max < 120 || max > 300) errs.targetMax = "Entre 120 e 300 mg/dL";
  if (!isNaN(min) && !isNaN(max) && max <= min) errs.targetMax = "Deve ser maior que o mínimo";
  return errs;
}

export default function NewPatientScreen() {
  const { theme } = useTheme();
  const { setActivePatient } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormState) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleCreate() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.fullName.trim(),
        date_of_birth: form.dateOfBirth,
        diagnosis_year: parseInt(form.diagnosisYear, 10),
        target_glucose_min_mgdl: parseInt(form.targetMin, 10),
        target_glucose_max_mgdl: parseInt(form.targetMax, 10),
      };
      if (form.insulinTypeBasal.trim())
        payload["insulin_type_basal"] = form.insulinTypeBasal.trim();
      if (form.insulinTypeBolus.trim())
        payload["insulin_type_bolus"] = form.insulinTypeBolus.trim();

      const created = await apiClient.post<PatientProfile>("/patients", payload);
      await setActivePatient(created);
      router.back();
    } catch {
      Alert.alert(
        "Erro",
        "Não foi possível criar o paciente. Verifique os dados e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: theme.colors.primary.surface,
                borderColor: theme.colors.primary.border,
              },
            ]}
          >
            <Icon name="info" size="sm" color={theme.colors.primary.DEFAULT} />
            <Text variant="bodySm" color={theme.colors.primary.dark} style={styles.infoText}>
              O consentimento de processamento de dados (LGPD Art. 14) é gerado automaticamente ao
              criar o perfil do paciente.
            </Text>
          </View>

          {/* Identificação */}
          <Text variant="h4" style={styles.sectionTitle}>
            Identificação
          </Text>
          <View style={styles.fields}>
            <Input
              label="Nome completo do paciente *"
              placeholder="Nome da criança"
              value={form.fullName}
              onChangeText={set("fullName")}
              autoCapitalize="words"
              error={errors.fullName}
              accessibilityLabel="Nome completo do paciente"
              leftElement={<Icon name="user" size="sm" color={theme.colors.text.tertiary} />}
            />
            <Input
              label="Data de nascimento *"
              placeholder="AAAA-MM-DD"
              value={form.dateOfBirth}
              onChangeText={set("dateOfBirth")}
              keyboardType="numbers-and-punctuation"
              error={errors.dateOfBirth}
              accessibilityLabel="Data de nascimento no formato ano mês dia"
              hint="Formato: 2018-06-15"
              leftElement={<Icon name="calendar" size="sm" color={theme.colors.text.tertiary} />}
            />
            <Input
              label="Ano do diagnóstico *"
              placeholder={String(new Date().getFullYear())}
              value={form.diagnosisYear}
              onChangeText={set("diagnosisYear")}
              keyboardType="number-pad"
              error={errors.diagnosisYear}
              accessibilityLabel="Ano do diagnóstico de diabetes tipo 1"
              leftElement={<Icon name="activity" size="sm" color={theme.colors.text.tertiary} />}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Alvos glicêmicos */}
          <Text variant="h4" style={styles.sectionTitle}>
            Alvos Glicêmicos (mg/dL)
          </Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Input
                label="Mínimo *"
                placeholder="70"
                value={form.targetMin}
                onChangeText={set("targetMin")}
                keyboardType="number-pad"
                error={errors.targetMin}
                accessibilityLabel="Glicemia mínima alvo em mg/dL"
              />
            </View>
            <View style={styles.halfField}>
              <Input
                label="Máximo *"
                placeholder="180"
                value={form.targetMax}
                onChangeText={set("targetMax")}
                keyboardType="number-pad"
                error={errors.targetMax}
                accessibilityLabel="Glicemia máxima alvo em mg/dL"
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Insulinas (opcionais) */}
          <Text variant="h4" style={styles.sectionTitle}>
            Insulinas (opcional)
          </Text>
          <View style={styles.fields}>
            <Input
              label="Tipo de insulina basal"
              placeholder="Ex: Lantus, Tresiba"
              value={form.insulinTypeBasal}
              onChangeText={set("insulinTypeBasal")}
              autoCapitalize="words"
              accessibilityLabel="Tipo de insulina basal"
              leftElement={<Icon name="droplet" size="sm" color={theme.colors.text.tertiary} />}
            />
            <Input
              label="Tipo de insulina bolus"
              placeholder="Ex: NovoLog, Humalog"
              value={form.insulinTypeBolus}
              onChangeText={set("insulinTypeBolus")}
              autoCapitalize="words"
              accessibilityLabel="Tipo de insulina bolus"
              leftElement={<Icon name="droplet" size="sm" color={theme.colors.text.tertiary} />}
            />
          </View>

          <Button
            variant="primary"
            size="lg"
            label="Criar perfil do paciente"
            onPress={() => void handleCreate()}
            loading={loading}
            fullWidth
            accessibilityLabel="Criar perfil do paciente e iniciar acompanhamento"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
  },
  infoText: { flex: 1, lineHeight: 18 },
  sectionTitle: { marginBottom: 16 },
  fields: { gap: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },
  divider: { marginVertical: 24 },
  submitBtn: { marginTop: 32 },
});
