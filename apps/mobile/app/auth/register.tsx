import React, { useState, useRef, useEffect } from "react";
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
import { SCREEN_HEIGHT } from "../../src/design/themes/layout.js";
import { easing, duration } from "../../src/design/themes/motion.js";

const HERO_BG = "#1E3A8A";
// Register hero is shorter — four fields need the room below
const HERO_H = Math.min(Math.round(SCREEN_HEIGHT * 0.38), 320);

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { register } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(14)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: duration.slow,
        easing: easing.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(heroY, {
        toValue: 0,
        duration: duration.slow,
        easing: easing.decelerate,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: duration.slow,
            easing: easing.decelerate,
            useNativeDriver: true,
          }),
          Animated.timing(formY, {
            toValue: 0,
            duration: duration.slow,
            easing: easing.decelerate,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [heroOpacity, heroY, formOpacity, formY]);

  const isFill = error === "fill";
  const nameError = isFill && !displayName ? "Informe seu nome" : undefined;
  const emailError = isFill && !email ? "Informe o e-mail" : undefined;
  const passwordError = isFill && !password ? "Informe a senha" : undefined;
  const confirmError = isFill && !confirmPassword ? "Confirme a senha" : undefined;
  const apiError = error && !isFill ? error : null;

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
      setError(
        e instanceof ApiError && e.status === 409
          ? "Este e-mail já está cadastrado."
          : "Não foi possível criar a conta. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: HERO_BG }]}>
      {/* ── Hero ── */}
      <View style={[styles.hero, { height: HERO_H, paddingTop: insets.top + 20 }]}>
        {/* Glow shifted to lower-left for visual variation vs login */}
        <View style={styles.glowOuter} accessible={false} />
        <View style={styles.glowInner} accessible={false} />

        <Animated.View
          style={[styles.heroContent, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
        >
          {/* Brand mark */}
          <View style={styles.brandRow}>
            <Icon name="activity" size="sm" color="rgba(255,255,255,0.75)" />
            <Text style={styles.brandWordmark}>SweetCare</Text>
          </View>

          {/* "Tudo começa / aqui." — invitation to a new care journey */}
          <View style={styles.heroFooter}>
            <Text style={styles.hlContext}>Tudo começa</Text>
            <Text style={styles.hlMain}>aqui.</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Form surface ── */}
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View
          style={[
            styles.formSurface,
            {
              backgroundColor: theme.colors.background.DEFAULT,
              opacity: formOpacity,
              transform: [{ translateY: formY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border.DEFAULT }]} />

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {apiError && (
              <View
                style={[
                  styles.errorStripe,
                  {
                    backgroundColor: theme.colors.error.surface,
                    borderLeftColor: theme.colors.error.DEFAULT,
                  },
                ]}
              >
                <Text variant="bodySm" color={theme.colors.error.DEFAULT}>
                  {apiError}
                </Text>
              </View>
            )}

            <View style={styles.fields}>
              <Input
                label="Nome completo"
                placeholder="Seu nome"
                value={displayName}
                onChangeText={(v) => {
                  setDisplayName(v);
                  if (error) setError(null);
                }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                error={nameError}
                accessibilityLabel="Campo de nome completo"
              />
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
              />
              <Input
                label="Senha"
                placeholder="Mínimo 12 caracteres"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                secureToggle
                textContentType="newPassword"
                error={passwordError}
                accessibilityLabel="Campo de senha"
              />
              <Input
                label="Confirmar senha"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (error) setError(null);
                }}
                secureToggle
                textContentType="newPassword"
                error={confirmError}
                accessibilityLabel="Campo de confirmação de senha"
              />
            </View>

            {/* Strength hint — shown only when password has content */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {([0, 1, 2] as const).map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthDot,
                      {
                        backgroundColor:
                          password.length >= 12
                            ? theme.colors.success.DEFAULT
                            : password.length >= 8
                              ? theme.colors.warning.DEFAULT
                              : i === 0
                                ? theme.colors.error.DEFAULT
                                : theme.colors.border.DEFAULT,
                      },
                    ]}
                  />
                ))}
                <Text
                  variant="caption"
                  color={
                    password.length >= 12
                      ? theme.colors.success.DEFAULT
                      : password.length >= 8
                        ? theme.colors.warning.DEFAULT
                        : theme.colors.error.DEFAULT
                  }
                  style={styles.strengthLabel}
                >
                  {password.length >= 12 ? "Senha forte" : password.length >= 8 ? "Média" : "Fraca"}
                </Text>
              </View>
            )}

            <Button
              variant="primary"
              size="lg"
              label="Criar minha conta"
              onPress={() => void handleRegister()}
              loading={loading}
              fullWidth
              accessibilityLabel="Criar conta no SweetCare"
              style={styles.submitBtn}
            />

            <View style={styles.loginRow}>
              <Text variant="bodySm" color={theme.colors.text.tertiary}>
                Já tem conta?{" "}
              </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Ir para o login">
                  <Text
                    variant="bodySm"
                    color={theme.colors.primary.DEFAULT}
                    style={styles.loginLink}
                  >
                    Entrar
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text
              variant="caption"
              color={theme.colors.text.tertiary}
              align="center"
              style={styles.legalText}
            >
              Seus dados são protegidos conforme a LGPD.{"\n"}Nunca compartilhamos informações de
              saúde.
            </Text>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    paddingHorizontal: 28,
    overflow: "hidden",
  },

  // Glow on lower-left this time — same language, different composition
  glowOuter: {
    position: "absolute",
    bottom: -40,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#2563EB",
    opacity: 0.2,
  },
  glowInner: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#1D4ED8",
    opacity: 0.18,
  },

  heroContent: { flex: 1 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandWordmark: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  heroFooter: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  hlContext: {
    fontSize: 17,
    fontWeight: "400",
    color: "rgba(255,255,255,0.52)",
    marginBottom: 2,
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
  hlMain: {
    fontSize: 38,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.8,
    lineHeight: 42,
    includeFontPadding: false,
  },

  kavWrapper: { flex: 1 },
  formSurface: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 28,
  },
  scroll: { paddingHorizontal: 24 },

  errorStripe: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    paddingLeft: 14,
    marginBottom: 20,
  },

  fields: { gap: 20, marginBottom: 16 },

  // Three-dot password strength — appears only when typing, never on load
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    marginTop: 4,
  },
  strengthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  strengthLabel: {
    marginLeft: 2,
  },

  submitBtn: {},

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginLink: { fontWeight: "600" },
  legalText: { marginTop: 24, lineHeight: 18 },
});
