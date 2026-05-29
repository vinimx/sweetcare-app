import React from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../../src/design/components/ui/Text.js";
import { Button } from "../../../../src/design/components/ui/Button.js";
import { useTheme } from "../../../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../../../src/infrastructure/api/client.js";
import InsulinLogScreen from "../../../../src/features/insulin/screens/InsulinLogScreen.js";
import type {
  ApiInsulinEvent,
  TimelineResponse,
  SuccessSignal,
} from "../../../../src/infrastructure/api/timeline.types.js";

export default function InsulinEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { activePatient } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

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

  function handleSuccess() {
    queryClient.setQueryData<SuccessSignal>(["_success_signal"], {
      type: "edit",
      ts: Date.now(),
    });
    void queryClient.invalidateQueries({ queryKey: ["timeline", activePatient?.id] });
    router.navigate("/");
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          title: "Editar Insulina",
          headerShown: true,
          headerBackTitle: "Detalhes",
        }}
      />

      {isLoading || !event || !activePatient ? (
        <View style={styles.center}>
          {isLoading ? (
            <Text variant="body" color={theme.colors.text.tertiary}>
              Carregando...
            </Text>
          ) : (
            <>
              <Text variant="h4" style={{ marginBottom: 8 }}>
                Registro não encontrado
              </Text>
              <Button
                variant="primary"
                label="Voltar"
                onPress={() => {
                  router.back();
                }}
                accessibilityLabel="Voltar"
              />
            </>
          )}
        </View>
      ) : (
        <InsulinLogScreen
          patientId={activePatient.id}
          recordId={id}
          initialData={{
            insulin_type: event.data.insulin_type,
            dose_units: event.data.dose_units,
            dose_rationale: event.data.dose_rationale,
            meal_carbs_grams: event.data.meal_carbs_grams ?? undefined,
            glucose_before_mgdl: event.data.glucose_before_mgdl ?? undefined,
            administration_site: event.data.administration_site ?? undefined,
            notes: event.data.notes ?? undefined,
          }}
          onSuccess={handleSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
});
