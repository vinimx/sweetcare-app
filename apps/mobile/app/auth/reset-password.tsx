import React, { useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Input } from "../../src/design/components/ui/Input.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { apiClient, ApiError } from "../../src/infrastructure/api/client.js";

type ScreenState = "form" | "success";

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>("form");

  const isFillError = error === "fill";
  const passwordError = isFillError && !password ? "Informe a nova senha" : undefined;
  const confirmError = isFillError && !confirmPassword ? "Confirme a nova senha" : undefined;
  const hasGenericError = error && error !== "fill";

  const tokenMissing = !token;

  async function handleSubmit() {
    setError(null);
    if (!password || !confirmPassword) {
      setError("fill");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password }, false);
      setScreen("success");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 400) {
          setError("Este link de redefinição é inválido ou já expirou. Solicite um novo.");
        } else if (e.status === 429) {
          setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else {
          setError("Não foi possível redefinir a senha. Tente novamente.");
        }
      } else {
        setError("Não foi possível conectar. Verifique sua conexão.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (tokenMissing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <View style={styles.centeredContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.error.surface }]}>
            <Icon name="alert-circle" size="xl" color={theme.colors.error.DEFAULT} />
          </View>
          <Text variant="h3" align="center" style={styles.title}>
            Link inválido
          </Text>
          <Text
            variant="bodySm"
            color={theme.colors.text.secondary}
            align="center"
            style={styles.subtitle}
          >
            Este link de redefinição de senha não é válido. Solicite um novo pelo app.
          </Text>
          <Button
            variant="primary"
            size="lg"
            label="Ir para o login"
            onPress={() => {
              router.replace("/auth/login");
            }}
            fullWidth
            style={styles.actionBtn}
            accessibilityLabel="Ir para a tela de login"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "success") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <View style={styles.centeredContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.success.surface }]}>
            <Icon name="check-circle" size="xl" color={theme.colors.success.DEFAULT} />
          </View>
          <Text variant="h2" align="center" style={styles.title}>
            Senha redefinida!
          </Text>
          <Text
            variant="bodySm"
            color={theme.colors.text.secondary}
            align="center"
            style={styles.subtitle}
          >
            Sua senha foi atualizada com sucesso. Faça login com a nova senha.
          </Text>
          <Button
            variant="primary"
            size="lg"
            label="Ir para o login"
            onPress={() => {
              router.replace("/auth/login");
            }}
            fullWidth
            style={styles.actionBtn}
            accessibilityLabel="Ir para a tela de login"
          />
        </View>
      </SafeAreaView>
    );
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
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary.surface }]}>
              <Icon name="lock" size="xl" color={theme.colors.primary.DEFAULT} />
            </View>
            <Text variant="h2" align="center" style={styles.title}>
              Nova senha
            </Text>
            <Text
              variant="bodySm"
              color={theme.colors.text.secondary}
              align="center"
              style={styles.subtitle}
            >
              Escolha uma senha forte com pelo menos 8 caracteres.
            </Text>
          </View>

          {/* Form card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.lg },
            ]}
          >
            {hasGenericError && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.colors.error.surface,
                    borderColor: theme.colors.error.border,
                  },
                ]}
              >
                <Icon name="alert-circle" size="sm" color={theme.colors.error.DEFAULT} />
                <Text variant="bodySm" color={theme.colors.error.DEFAULT} style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            <View style={styles.fields}>
              <Input
                label="Nova senha"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                secureToggle
                textContentType="newPassword"
                error={passwordError}
                accessibilityLabel="Campo de nova senha"
                leftElement={<Icon name="lock" size="sm" color={theme.colors.text.tertiary} />}
              />
              <Input
                label="Confirmar nova senha"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (error) setError(null);
                }}
                secureToggle
                textContentType="newPassword"
                error={confirmError}
                accessibilityLabel="Campo de confirmação da nova senha"
                leftElement={<Icon name="lock" size="sm" color={theme.colors.text.tertiary} />}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label="Redefinir senha"
              onPress={() => void handleSubmit()}
              loading={loading}
              fullWidth
              accessibilityLabel="Confirmar redefinição de senha"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  header: { alignItems: "center", marginBottom: 32 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { marginBottom: 8 },
  subtitle: { lineHeight: 22 },
  card: { borderRadius: 20, padding: 28 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { flex: 1 },
  fields: { gap: 16, marginBottom: 24 },
  actionBtn: { marginTop: 24 },
});
