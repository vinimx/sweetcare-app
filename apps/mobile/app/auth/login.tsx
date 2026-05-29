import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../src/design/components/ui/Text.js";
import { Button } from "../../src/design/components/ui/Button.js";
import { Input } from "../../src/design/components/ui/Input.js";
import { Icon } from "../../src/design/components/ui/Icon.js";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";
import { useAuth } from "../../src/infrastructure/auth/AuthContext.js";
import { ApiError } from "../../src/infrastructure/api/client.js";

/** Geometric dot grid rendered as decorative background */
function DotGrid() {
  const cols = 11;
  const rows = 7;
  const dots = Array.from({ length: rows * cols }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: col * 34 + (row % 2 === 0 ? 0 : 17),
      y: row * 26,
    };
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: "none" }]}>
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: d.x,
            top: d.y,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        />
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const emailError = error === "fill" && !email.trim() ? "Informe o e-mail" : undefined;
  const passwordError = error === "fill" && !password ? "Informe a senha" : undefined;

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError("fill");
      triggerShake();
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
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  const BRAND_BG = theme.colors.primary.DEFAULT; // #2563EB

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background.DEFAULT }]}>
      {/* ── Branded hero section ──────────────────── */}
      <View
        style={[
          styles.hero,
          {
            backgroundColor: BRAND_BG,
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <DotGrid />

        {/* Logo mark */}
        <View style={styles.logoMark}>
          <View style={styles.logoInner}>
            <Icon name="heart" size="xl" color="#fff" />
          </View>
          <View style={styles.logoPing} />
        </View>

        {/* Brand text */}
        <Text variant="h1" color="#fff" align="center" style={styles.appName}>
          SweetCare
        </Text>
        <Text variant="bodySm" color="rgba(255,255,255,0.72)" align="center" style={styles.tagline}>
          Cuidado preciso para crianças com T1DM
        </Text>
      </View>

      {/* ── Form section ─────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {/* Error banner */}
            {error && error !== "fill" && (
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

            {/* Form fields */}
            <Text variant="h3" style={styles.formTitle}>
              Entrar na conta
            </Text>

            <View style={styles.fields}>
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
                accessibilityLabel="Campo de e-mail"
                leftElement={<Icon name="mail" size="sm" color={theme.colors.text.tertiary} />}
              />
              <Input
                label="Senha"
                placeholder="Sua senha"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
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
            />

            <View style={styles.registerRow}>
              <Text variant="bodySm" color={theme.colors.text.secondary}>
                Não tem conta?{" "}
              </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Criar nova conta">
                  <Text
                    variant="bodySm"
                    color={theme.colors.primary.DEFAULT}
                    style={styles.registerLink}
                  >
                    Criar conta
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>

          {/* LGPD footer */}
          <View style={styles.lgpdRow}>
            <Icon name="lock" size="xs" color={theme.colors.text.tertiary} />
            <Text
              variant="caption"
              color={theme.colors.text.tertiary}
              align="center"
              style={styles.lgpdText}
            >
              Dados protegidos por criptografia e LGPD
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  /* Hero */
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoMark: {
    width: 72,
    height: 72,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPing: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  appName: { fontWeight: "700", letterSpacing: -0.5, marginBottom: 6 },
  tagline: { lineHeight: 20 },

  /* Form */
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  formTitle: { marginBottom: 24 },
  fields: { gap: 16, marginBottom: 24 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorText: { flex: 1 },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerLink: { fontWeight: "600" },

  /* Footer */
  lgpdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 36,
  },
  lgpdText: { lineHeight: 16 },
});
