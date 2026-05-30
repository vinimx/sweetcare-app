import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../src/design/components/ui/Input.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { apiClient } from "../../src/infrastructure/api/client.js";

export default function ProfileEditScreen() {
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSave() {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("O nome não pode estar vazio.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await apiClient.patch("/users/me", { display_name: trimmed });
      await refreshUser();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ title: "Editar Perfil", headerShown: true }} />
      <View style={styles.container}>
        <Input
          label="Nome de exibição"
          value={displayName}
          onChangeText={(v) => {
            setDisplayName(v);
            setError(undefined);
          }}
          error={error}
          autoFocus
          accessibilityLabel="Nome de exibição"
        />
        <Button
          variant="primary"
          size="lg"
          label={saving ? "Salvando..." : "Salvar"}
          onPress={() => {
            void handleSave();
          }}
          disabled={saving}
          fullWidth
          style={styles.btn}
          accessibilityLabel="Salvar nome"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 20 },
  btn: { marginTop: 24 },
});
