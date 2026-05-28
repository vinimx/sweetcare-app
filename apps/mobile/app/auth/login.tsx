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

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = error && !email ? "Informe o e-mail" : undefined;
  const passwordError = error && !password ? "Informe a senha" : undefined;

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError("fill");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError("Não foi possível conectar. Tente novamente.");
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
          {/* Logo / brand */}
          <View style={styles.brand}>
            <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary.surface }]}>
              <Icon name="heart" size="xl" color={theme.colors.primary.DEFAULT} />
            </View>
            <Text variant="h1" align="center" style={styles.appName}>
              SweetCare
            </Text>
            <Text variant="bodySm" color={theme.colors.text.secondary} align="center">
              Cuidado inteligente para crianças com T1DM
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
              Entrar na conta
            </Text>

            {error && !emailError && !passwordError && (
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
                placeholder="Sua senha"
                value={password}
                onChangeText={setPassword}
                secureToggle
                textContentType="password"
                error={passwordError}
                accessibilityLabel="Campo de senha"
                leftElement={<Icon name="lock" size="sm" color={theme.colors.text.tertiary} />}
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label="Entrar"
              onPress={() => void handleLogin()}
              loading={loading}
              fullWidth
              accessibilityLabel="Entrar na conta SweetCare"
              style={styles.submitBtn}
            />

            <View style={styles.divRow}>
              <Text variant="bodySm" color={theme.colors.text.secondary}>
                Não tem conta?{" "}
              </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Criar nova conta">
                  <Text variant="bodySm" color={theme.colors.primary.DEFAULT} style={styles.link}>
                    Criar conta
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* Footer */}
          <Text
            variant="caption"
            color={theme.colors.text.tertiary}
            align="center"
            style={styles.footer}
          >
            Seus dados são armazenados com criptografia{"\n"}e protegidos pela LGPD.
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
  brand: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: { marginBottom: 6 },
  card: {
    borderRadius: 20,
    padding: 28,
  },
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
