import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Input } from "../../src/design/components/ui/Input.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { ApiError } from "../../src/infrastructure/api/client.js";

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { register } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFillError = error === "fill";
  const nameError = isFillError && !displayName ? "Informe seu nome" : undefined;
  const emailError = isFillError && !email ? "Informe o e-mail" : undefined;
  const passwordError = isFillError && !password ? "Informe a senha" : undefined;
  const confirmError = isFillError && !confirmPassword ? "Confirme a senha" : undefined;
  const hasGenericError = error && !nameError && !emailError && !passwordError && !confirmError;

  async function handleRegister() {
    setError(null);
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("fill");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 12) {
      setError("A senha deve ter pelo menos 12 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("Este e-mail já está cadastrado.");
      } else {
        setError("Não foi possível criar a conta. Tente novamente.");
      }
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
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary.surface }]}>
              <Icon name="user-plus" size="xl" color={theme.colors.primary.DEFAULT} />
            </View>
            <Text variant="h1" align="center" style={styles.title}>
              Criar conta
            </Text>
            <Text variant="bodySm" color={theme.colors.text.secondary} align="center">
              Cadastre-se para cuidar de uma criança com T1DM
            </Text>
          </View>

          {/* Form card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface.DEFAULT, ...theme.shadows.lg },
            ]}
          >
            <Text variant="h3" style={styles.cardTitle}>
              Seus dados
            </Text>

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
                label="Nome completo"
                placeholder="Seu nome"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                error={nameError}
                accessibilityLabel="Campo de nome completo"
                leftElement={<Icon name="user" size="sm" color={theme.colors.text.tertiary} />}
              />
              <Input
                label="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                error={emailError}
                accessibilityLabel="Campo de e-mail"
                leftElement={<Icon name="mail" size="sm" color={theme.colors.text.tertiary} />}
              />
              <Input
                label="Senha"
                placeholder="Mínimo 12 caracteres"
                value={password}
                onChangeText={setPassword}
                secureToggle
                textContentType="newPassword"
                error={passwordError}
                accessibilityLabel="Campo de senha"
                leftElement={<Icon name="lock" size="sm" color={theme.colors.text.tertiary} />}
              />
              <Input
                label="Confirmar senha"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureToggle
                textContentType="newPassword"
                error={confirmError}
                accessibilityLabel="Campo de confirmação de senha"
                leftElement={<Icon name="lock" size="sm" color={theme.colors.text.tertiary} />}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label="Criar conta"
              onPress={() => void handleRegister()}
              loading={loading}
              fullWidth
              accessibilityLabel="Criar conta no SweetCare"
              style={styles.submitBtn}
            />

            <View style={styles.divRow}>
              <Text variant="bodySm" color={theme.colors.text.secondary}>
                Já tem conta?{" "}
              </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Ir para o login">
                  <Text variant="bodySm" color={theme.colors.primary.DEFAULT} style={styles.link}>
                    Entrar
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <Text
            variant="caption"
            color={theme.colors.text.tertiary}
            align="center"
            style={styles.footer}
          >
            Ao criar uma conta, você concorda com nossos{"\n"}termos de uso e política de
            privacidade (LGPD).
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { marginBottom: 6 },
  card: { borderRadius: 20, padding: 28 },
  cardTitle: { marginBottom: 20 },
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
  submitBtn: {},
  divRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  link: { fontWeight: "600" },
  footer: { marginTop: 32, lineHeight: 18 },
});
