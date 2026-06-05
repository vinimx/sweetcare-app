import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Input } from "../../src/design/components/ui/Input.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { apiClient, ApiError } from "../../src/infrastructure/api/client.js";

type ScreenState = "form" | "sent";

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>("form");

  const emailError = error === "fill" && !email.trim() ? "Informe o e-mail" : undefined;
  const hasGenericError = error && error !== "fill";

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("fill");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim().toLowerCase() }, false);
      setScreen("sent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Não foi possível processar a solicitação. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (screen === "sent") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background.DEFAULT }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.success.surface }]}>
              <Icon name="mail" size="xl" color={theme.colors.success.DEFAULT} />
            </View>
            <Text variant="h2" align="center" style={styles.title}>
              Verifique seu e-mail
            </Text>
            <Text
              variant="body"
              color={theme.colors.text.secondary}
              align="center"
              style={styles.subtitle}
            >
              Se{" "}
              <Text variant="body" style={{ fontWeight: "600" }}>
                {email}
              </Text>{" "}
              estiver cadastrado, você receberá um link de redefinição em breve.
            </Text>
            <Text
              variant="bodySm"
              color={theme.colors.text.tertiary}
              align="center"
              style={styles.hint}
            >
              Não esqueça de verificar a pasta de spam.{"\n"}O link expira em 60 minutos.
            </Text>
          </View>

          <Button
            variant="primary"
            size="lg"
            label="Voltar ao login"
            onPress={() => {
              router.replace("/auth/login");
            }}
            fullWidth
            accessibilityLabel="Voltar para a tela de login"
          />

          <TouchableOpacity
            style={styles.retryRow}
            onPress={() => {
              setScreen("form");
              setError(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Tentar com outro e-mail"
          >
            <Text variant="bodySm" color={theme.colors.primary.DEFAULT}>
              Tentar com outro e-mail
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o login"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow-left" size="md" color={theme.colors.text.primary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary.surface }]}>
              <Icon name="lock" size="xl" color={theme.colors.primary.DEFAULT} />
            </View>
            <Text variant="h2" align="center" style={styles.title}>
              Esqueceu a senha?
            </Text>
            <Text
              variant="bodySm"
              color={theme.colors.text.secondary}
              align="center"
              style={styles.subtitle}
            >
              Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
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

            <Input
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              error={emailError}
              accessibilityLabel="Campo de e-mail para redefinição de senha"
              leftElement={<Icon name="mail" size="sm" color={theme.colors.text.tertiary} />}
            />

            <Button
              variant="primary"
              size="lg"
              label="Enviar link de redefinição"
              onPress={() => void handleSubmit()}
              loading={loading}
              fullWidth
              style={styles.submitBtn}
              accessibilityLabel="Enviar link de redefinição de senha"
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 16, alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
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
  hint: { marginTop: 12, lineHeight: 20 },
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
  submitBtn: { marginTop: 20 },
  retryRow: {
    alignItems: "center",
    marginTop: 20,
    minHeight: 44,
    justifyContent: "center",
  },
});
