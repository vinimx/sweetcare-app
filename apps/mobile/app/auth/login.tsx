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

// Deep navy — not the clinical blue, the 3am monitoring screen blue.
// Trusted, present, eyes-open at all hours.
const HERO_BG = "#1E3A8A";
const HERO_H = Math.min(Math.round(SCREEN_HEIGHT * 0.44), 380);

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrance: hero content drifts up while form surface rises beneath it
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(14)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(10)).current;
  const shakeX = useRef(new Animated.Value(0)).current;

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

  function triggerShake() {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  const emailError = error === "fill" && !email.trim() ? "Informe o e-mail" : undefined;
  const passwordError = error === "fill" && !password ? "Informe a senha" : undefined;
  const apiError = error && error !== "fill" ? error : null;

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
      setError(
        e instanceof ApiError && e.status === 401
          ? "E-mail ou senha incorretos."
          : "Não foi possível conectar. Tente novamente.",
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: HERO_BG }]}>
      {/* ── Hero ────────────────────────────────────────── */}
      <View style={[styles.hero, { height: HERO_H, paddingTop: insets.top + 20 }]}>
        {/* Ambient depth — two concentric glows, upper-right, no gradients */}
        <View style={styles.glowOuter} accessible={false} />
        <View style={styles.glowInner} accessible={false} />

        <Animated.View
          style={[styles.heroContent, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
        >
          {/* Brand mark — small, corner-anchored, like an app you already trust */}
          <View style={styles.brandRow}>
            <Icon name="activity" size="sm" color="rgba(255,255,255,0.75)" />
            <Text style={styles.brandWordmark}>SweetCare</Text>
          </View>

          {/* Dual-register headline — context whispers, statement asserts */}
          <View style={styles.heroFooter}>
            <Text style={styles.hlContext}>Bem-vindo</Text>
            <Text style={styles.hlMain}>de volta.</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Form surface — rises from beneath the hero ── */}
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
          {/* Drag handle — signals scrollability, adds tactile quality */}
          <View style={[styles.handle, { backgroundColor: theme.colors.border.DEFAULT }]} />

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
              {/* API-level error — left-border accent, not a full box */}
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
                />
              </View>

              <Button
                variant="primary"
                size="lg"
                label="Entrar no SweetCare"
                onPress={() => void handleLogin()}
                loading={loading}
                fullWidth
                accessibilityLabel="Entrar na conta SweetCare"
              />

              <Link href="/auth/forgot-password" asChild>
                <TouchableOpacity
                  style={styles.forgotBtn}
                  accessibilityRole="link"
                  accessibilityLabel="Esqueci a senha"
                >
                  <Text variant="bodySm" color={theme.colors.text.secondary}>
                    Esqueci a senha
                  </Text>
                </TouchableOpacity>
              </Link>
            </Animated.View>

            <View style={styles.createRow}>
              <Text variant="bodySm" color={theme.colors.text.tertiary}>
                Não tem conta?{" "}
              </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Criar nova conta">
                  <Text
                    variant="bodySm"
                    color={theme.colors.primary.DEFAULT}
                    style={styles.createLink}
                  >
                    Criar conta
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ──────────────────────────────────────
  hero: {
    paddingHorizontal: 28,
    overflow: "hidden",
  },

  // Two concentric glows, upper-right, blue-on-navy depth
  glowOuter: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#2563EB",
    opacity: 0.22,
  },
  glowInner: {
    position: "absolute",
    top: 10,
    right: 50,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#60A5FA",
    opacity: 0.12,
  },

  heroContent: {
    flex: 1,
  },
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

  // Headline anchored to bottom of hero — empty space above is a design element
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

  // ── Form ──────────────────────────────────────
  kavWrapper: { flex: 1 },

  // Organic scoop edge — form surface rises over hero with rounded top corners
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

  fields: { gap: 20, marginBottom: 28 },

  forgotBtn: {
    alignItems: "center",
    marginTop: 16,
    minHeight: 44,
    justifyContent: "center",
  },

  createRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  createLink: { fontWeight: "600" },
});
