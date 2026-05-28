# SweetCare Design System — v1.0.0

> **React Native · Expo SDK 52 · TypeScript**
>
> Design system safety-critical para cuidadores de crianças com Diabetes Mellitus Tipo 1.
> Todo componente, token e padrão de interação prioriza **clareza cognitiva em situações de emergência**,
> **acessibilidade WCAG 2.1 AA** e **rastreabilidade clínica** dos dados exibidos.

---

## Índice

1. [Princípios de Design](#1-princípios-de-design)
2. [Tokens — Colors](#2-tokens--colors)
3. [Tokens — Typography](#3-tokens--typography)
4. [Tokens — Spacing](#4-tokens--spacing)
5. [Tokens — Shadows](#5-tokens--shadows)
6. [Tokens — Motion](#6-tokens--motion)
7. [Tokens — Layout](#7-tokens--layout)
8. [ThemeContext](#8-themecontext)
9. [Componentes UI Base](#9-componentes-ui-base)
10. [Componentes de Domínio](#10-componentes-de-domínio)
11. [Componentes de Layout](#11-componentes-de-layout)
12. [Utils — Haptics](#12-utils--haptics)
13. [Acessibilidade](#13-acessibilidade)
14. [Estados Globais de UI](#14-estados-globais-de-ui)
15. [Referência de Implementação](#15-referência-de-implementação)

---

## 1. Princípios de Design

| #      | Princípio                     | Implicação                                                                                                                   |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **P1** | **Clareza em emergências**    | Ações críticas devem ser acessíveis com 1 toque; hierarquia visual nunca pode ser ambígua em situações de hipoglicemia grave |
| **P2** | **Carga cognitiva mínima**    | Cuidadores operam sob estresse; evitar confirmações redundantes, microtextos desnecessários e paletas coloridas demais       |
| **P3** | **Acessibilidade first**      | WCAG 2.1 AA obrigatório; contraste ≥ 4.5:1 em texto, ≥ 3:1 em elementos UI; touch targets ≥ 44pt                             |
| **P4** | **Feedback clínico honesto**  | Cores de glicemia seguem padrão médico amplamente reconhecido (verde = range, amarelo = atenção, vermelho = risco)           |
| **P5** | **Estado offline visível**    | Toda tela que depende de dados remotos deve indicar explicitamente o modo offline e a data do último sync                    |
| **P6** | **PHI protegido visualmente** | Dados de identificação do paciente devem ser mascaráveis; nunca exibir PHI raw em notificações push                          |

---

## 2. Tokens — Colors

**Arquivo**: `src/design/themes/colors.ts`

### 2.1 Paleta Base

```typescript
export const palette = {
  // ── Brand Blue ──────────────────────────────────────────────────────────
  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue200: "#BFDBFE",
  blue300: "#93C5FD",
  blue400: "#60A5FA",
  blue500: "#3B82F6",
  blue600: "#2563EB", // ← primary.DEFAULT (tab active, CTAs principais)
  blue700: "#1D4ED8",
  blue800: "#1E40AF",
  blue900: "#1E3A8A",

  // ── Slate (neutros) ──────────────────────────────────────────────────────
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",

  // ── Green (sucesso / glicemia normal) ────────────────────────────────────
  green50: "#F0FDF4",
  green100: "#DCFCE7",
  green200: "#BBF7D0",
  green500: "#22C55E",
  green600: "#16A34A",
  green700: "#15803D",
  green900: "#14532D",

  // ── Amber (atenção / hiperglicemia leve / meal_coverage) ─────────────────
  amber50: "#FFFBEB",
  amber100: "#FEF3C7",
  amber200: "#FDE68A",
  amber500: "#F59E0B",
  amber600: "#D97706",
  amber700: "#B45309",
  amber900: "#78350F",

  // ── Orange (hipoglicemia leve / sintomas mild-moderate) ──────────────────
  orange50: "#FFF7ED",
  orange100: "#FFEDD5",
  orange200: "#FED7AA",
  orange500: "#F97316",
  orange600: "#EA580C",
  orange700: "#C2410C",

  // ── Red (emergência / hipoglicemia grave / erros críticos) ───────────────
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red200: "#FECACA",
  red400: "#F87171",
  red500: "#EF4444",
  red600: "#DC2626", // ← emergency header (alerts/[alertId])
  red700: "#B91C1C",
  red800: "#991B1B",
  red900: "#7F1D1D", // ← emergency fullScreenModal header

  // ── White / Black ────────────────────────────────────────────────────────
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;
```

### 2.2 Tokens Semânticos

```typescript
export const colors = {
  // ── Brand ────────────────────────────────────────────────────────────────
  primary: {
    DEFAULT: palette.blue600, // #2563EB
    light: palette.blue400,
    dark: palette.blue700,
    surface: palette.blue50,
    border: palette.blue200,
  },

  // ── Glicemia — padrão clínico de cores ──────────────────────────────────
  glucose: {
    // Range alvo do paciente (configurable per PatientProfile)
    normal: palette.green600, // #16A34A
    normalSurface: palette.green50,
    normalBorder: palette.green200,

    // Hiperglicemia leve/moderada
    high: palette.amber600, // #D97706
    highSurface: palette.amber50,
    highBorder: palette.amber200,

    // Hipoglicemia — atenção imediata
    low: palette.orange600, // #EA580C
    lowSurface: palette.orange50,
    lowBorder: palette.orange200,

    // Hipoglicemia grave / emergência
    critical: palette.red600, // #DC2626
    criticalSurface: palette.red50,
    criticalBorder: palette.red200,

    // Sem leitura disponível
    unknown: palette.slate400,
    unknownSurface: palette.slate100,
  },

  // ── Severity levels (SeverityLevel do domínio) ───────────────────────────
  severity: {
    mild: {
      text: palette.amber700,
      surface: palette.amber50,
      border: palette.amber200,
      icon: palette.amber600,
    },
    moderate: {
      text: palette.orange700,
      surface: palette.orange50,
      border: palette.orange200,
      icon: palette.orange600,
    },
    severe: {
      text: palette.red700,
      surface: palette.red50,
      border: palette.red200,
      icon: palette.red600,
    },
    emergency: {
      text: palette.white,
      surface: palette.red600, // fundo vermelho sólido — máximo contraste
      border: palette.red700,
      icon: palette.white,
    },
  },

  // ── Alert types (AlertSeverity do domínio) ───────────────────────────────
  alert: {
    warning: { bg: palette.amber50, border: palette.amber400, icon: palette.amber600 },
    critical: { bg: palette.red50, border: palette.red500, icon: palette.red600 },
    emergency: { bg: palette.red600, border: palette.red700, icon: palette.white },
  },

  // ── Sync status (SyncStatus do domínio) ─────────────────────────────────
  sync: {
    pending: { color: palette.amber600, surface: palette.amber50 },
    synced: { color: palette.green600, surface: palette.green50 },
    conflict: { color: palette.red600, surface: palette.red50 },
  },

  // ── Feedback semântico ───────────────────────────────────────────────────
  success: { DEFAULT: palette.green600, surface: palette.green50, border: palette.green200 },
  warning: { DEFAULT: palette.amber600, surface: palette.amber50, border: palette.amber200 },
  error: { DEFAULT: palette.red600, surface: palette.red50, border: palette.red200 },
  info: { DEFAULT: palette.blue600, surface: palette.blue50, border: palette.blue200 },

  // ── Superfícies de UI ────────────────────────────────────────────────────
  background: {
    DEFAULT: palette.slate50,
    elevated: palette.white,
    emergency: palette.red900, // fullScreenModal de emergência
  },
  surface: {
    DEFAULT: palette.white,
    subtle: palette.slate50,
    overlay: "rgba(15, 23, 42, 0.5)", // slate900 com 50% opacidade
  },

  // ── Texto ────────────────────────────────────────────────────────────────
  text: {
    primary: palette.slate900,
    secondary: palette.slate600,
    tertiary: palette.slate400,
    disabled: palette.slate300,
    inverse: palette.white,
    link: palette.blue600,
    error: palette.red600,
  },

  // ── Bordas ───────────────────────────────────────────────────────────────
  border: {
    DEFAULT: palette.slate200,
    subtle: palette.slate100,
    strong: palette.slate300,
  },
} as const;
```

### 2.3 Mapeamento Glicemia → Cor

| Leitura (mg/dL)         | Estado clínico              | Token              |
| ----------------------- | --------------------------- | ------------------ |
| < 54                    | Hipoglicemia grave          | `glucose.critical` |
| 54–69                   | Hipoglicemia                | `glucose.low`      |
| 70–`targetMin`          | Abaixo do range             | `glucose.low`      |
| `targetMin`–`targetMax` | No range alvo               | `glucose.normal`   |
| `targetMax`–250         | Acima do range              | `glucose.high`     |
| > 250                   | Hiperglicemia significativa | `glucose.critical` |
| Sem leitura             | —                           | `glucose.unknown`  |

> `targetMin` e `targetMax` vêm de `PatientProfile.targetGlucoseMinMgdl` / `targetGlucoseMaxMgdl`.
> Bounds absolutos do domínio: `GLUCOSE_MIN_MGDL = 20`, `GLUCOSE_MAX_MGDL = 600`.

---

## 3. Tokens — Typography

**Arquivo**: `src/design/themes/typography.ts`

```typescript
export const fontFamilies = {
  // Usar System font para máxima legibilidade e performance nativa
  sans: "System", // San Francisco (iOS) / Roboto (Android)
  mono: "System", // Courier New fallback para valores numéricos clínicos
} as const;

export const fontSizes = {
  xs: 12, // labels auxiliares, legendas
  sm: 14, // texto secundário, metadados
  md: 16, // base — mínimo obrigatório para textos de alerta (CLAUDE.md)
  lg: 18, // texto de destaque, valores numéricos de dose
  xl: 20, // títulos de seção
  "2xl": 24, // títulos de tela
  "3xl": 30, // valores numéricos grandes (glicemia em destaque)
  "4xl": 36, // emergência — máxima legibilidade
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeights = {
  tight: 1.2, // títulos curtos
  snug: 1.35, // labels e badges
  normal: 1.5, // corpo de texto
  relaxed: 1.7, // instruções de emergência — espaço extra para leitura sob estresse
} as const;

export const letterSpacings = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1.0, // labels de unidade (mg/dL, U, g)
} as const;
```

### 3.1 Variantes de Texto

| Variante    | size   | weight   | lineHeight | Uso                                                              |
| ----------- | ------ | -------- | ---------- | ---------------------------------------------------------------- |
| `display`   | 4xl/36 | bold     | tight      | Valores de emergência em destaque                                |
| `h1`        | 3xl/30 | bold     | tight      | Título principal de tela                                         |
| `h2`        | 2xl/24 | semibold | snug       | Título de seção                                                  |
| `h3`        | xl/20  | semibold | snug       | Subtítulo / card header                                          |
| `h4`        | lg/18  | semibold | snug       | Label de grupo                                                   |
| `bodyLg`    | lg/18  | regular  | normal     | Corpo principal — valores clínicos                               |
| `body`      | md/16  | regular  | normal     | Corpo padrão                                                     |
| `bodySm`    | sm/14  | regular  | normal     | Texto secundário                                                 |
| `label`     | sm/14  | medium   | snug       | Labels de campo                                                  |
| `caption`   | xs/12  | regular  | snug       | Metadados, timestamps                                            |
| `numeric`   | lg/18  | bold     | tight      | Valores numéricos (dose, glicemia) — `fontVariant: tabular-nums` |
| `numericLg` | 3xl/30 | bold     | tight      | Glicemia em destaque (GlucoseIndicator)                          |
| `unit`      | sm/14  | medium   | snug       | Unidades (mg/dL, U, g) — `letterSpacing: wider`                  |
| `emergency` | 2xl/24 | bold     | relaxed    | Instruções de protocolo de emergência                            |
| `button`    | md/16  | semibold | tight      | Texto de botão                                                   |
| `buttonSm`  | sm/14  | semibold | tight      | Botão pequeno                                                    |

---

## 4. Tokens — Spacing

**Arquivo**: `src/design/themes/spacing.ts`

```typescript
// Base: 4pt grid — alinhamento e consistência visual
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44, // ← WCAG mínimo touch target
  12: 48,
  14: 56, // ← Tab bar mínimo (CLAUDE.md: tabBarItemStyle.minHeight)
  16: 64, // ← Botão de emergência
  20: 80,
  24: 96,
  32: 128,
} as const;

// Touch targets — regra de acessibilidade obrigatória
export const touchTargets = {
  min: 44, // WCAG 2.1 AA mínimo absoluto
  comfortable: 56, // Tab bar e ações frequentes (código existente)
  large: 64, // Botões de emergência e ações safety-critical
} as const;

// Border radius
export const radii = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999, // círculos e pills
} as const;

// Border widths
export const borderWidths = {
  hairline: 0.5, // StyleSheet.hairlineWidth
  thin: 1,
  medium: 1.5,
  thick: 2,
  emphasis: 3, // bordas de alerta/emergência
} as const;
```

---

## 5. Tokens — Shadows

**Arquivo**: `src/design/themes/shadows.ts`

```typescript
import type { ViewStyle } from "react-native";

type Shadow = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

export const shadows: Record<string, Shadow> = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Elevação sutil — cards em repouso
  sm: {
    shadowColor: "#0F172A", // slate900
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },

  // Elevação padrão — cards interativos, inputs
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  // Elevação alta — modais, FABs
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },

  // Elevação máxima — bottom sheets
  xl: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
  },

  // Sombra de emergência — feedback visual de alerta crítico
  emergency: {
    shadowColor: "#DC2626", // red600
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // Sombra de sucesso — confirmação de registro salvo
  success: {
    shadowColor: "#16A34A", // green600
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};
```

---

## 6. Tokens — Motion

**Arquivo**: `src/design/themes/motion.ts`

```typescript
import { Easing } from "react-native";

export const duration = {
  instant: 0,
  fast: 150, // micro-interações (feedback tátil, toggle)
  normal: 250, // transições padrão
  slow: 400, // modais, bottom sheets
  verySlow: 600, // onboarding, animações educativas
} as const;

export const easing = {
  // Standard — entradas e saídas de elementos de UI
  standard: Easing.bezier(0.2, 0.0, 0, 1.0),
  // Decelerate — entrada de elementos (slide in)
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  // Accelerate — saída de elementos (slide out)
  accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  // Emphasis — atenção (pulsação de emergência)
  emphasis: Easing.bezier(0.2, 0.0, 0, 1.0),
  // Linear — loaders
  linear: Easing.linear,
} as const;

// Presets de animação comuns
export const transitions = {
  // Fade padrão
  fade: {
    duration: duration.normal,
    easing: easing.standard,
  },
  // Slide from bottom (modais)
  slideUp: {
    duration: duration.slow,
    easing: easing.decelerate,
  },
  // Feedback de botão pressionado
  press: {
    duration: duration.fast,
    easing: easing.accelerate,
  },
  // Pulsação de alerta de emergência
  emergencyPulse: {
    duration: 800,
    iterations: -1, // infinito até resolução
    easing: easing.emphasis,
  },
} as const;

// Suporte a preferência de redução de movimento (Accessibility)
// Usar AccessibilityInfo.isReduceMotionEnabled() em runtime
// Quando true: substituir todas as animações por fade instant ou nenhuma
export const reducedMotionFallback = {
  duration: duration.fast,
  easing: easing.linear,
} as const;
```

---

## 7. Tokens — Layout

**Arquivo**: `src/design/themes/layout.ts`

```typescript
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Grid de 4 colunas em mobile
export const grid = {
  columns: 4,
  gutter: 16, // espaço entre colunas
  margin: 16, // margem lateral da tela
  columnWidth: (SCREEN_WIDTH - 32 - 3 * 16) / 4, // (width - 2*margin - gutters) / cols
} as const;

// Dimensões fixas de componentes — nunca usar valores mágicos inline
export const sizes = {
  // Barras de navegação
  tabBar: {
    height: 56, // tabBarItemStyle.minHeight (código existente)
    iconSize: 24,
  },
  header: {
    height: 56,
    compact: 44,
  },
  // Inputs
  input: {
    height: 48,
    heightSm: 40,
    heightLg: 56,
  },
  // Botões
  button: {
    heightSm: 36,
    height: 48,
    heightLg: 56,
    heightEmergency: 64,
  },
  // Ícones
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24, // padrão de tab icon
    xl: 32,
    "2xl": 48,
    emergency: 56, // ícone de emergência em destaque
  },
  // Avatar / foto de perfil
  avatar: {
    sm: 32,
    md: 40,
    lg: 56,
  },
  // Thumbnail de paciente no DoseCard
  patientBadge: {
    size: 36,
  },
  // Indicador de glicemia grande
  glucoseDisplay: {
    circleSize: 120,
    fontSize: 30,
  },
  // Toast/snackbar
  toast: {
    maxWidth: SCREEN_WIDTH - 32,
  },
  // Safe area padrão (complementar ao useSafeAreaInsets)
  screen: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
} as const;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
```

---

## 8. ThemeContext

**Arquivo**: `src/design/contexts/ThemeContext.tsx`

### Interface

```typescript
interface Theme {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: {
    fontSizes: typeof fontSizes;
    fontWeights: typeof fontWeights;
    lineHeights: typeof lineHeights;
    letterSpacings: typeof letterSpacings;
  };
  motion: typeof transitions;
  layout: typeof sizes;
  dark: boolean; // false = light mode (v1.0.0 — dark mode planejado)
}

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  // Futuro (v2): toggleDark: () => void;
}
```

### Uso

```typescript
// Provider — wraps em apps/mobile/app/_layout.tsx dentro de QueryClientProvider
<ThemeProvider>
  {children}
</ThemeProvider>

// Consumo
const { theme } = useTheme();
const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.DEFAULT,
    padding: theme.spacing[4],
  },
});
```

> **v1.0.0**: apenas light mode. Dark mode planejado para v2 quando os tokens semânticos
> (que já abstraem os valores primitivos) serão remapeados sem alterar a API dos componentes.

---

## 9. Componentes UI Base

> **Localização**: `src/design/components/ui/`
> **Regra**: zero lógica de negócio, zero imports de domínio. Props tipadas, acessibilidade embutida.

---

### 9.1 Text

**Arquivo**: `src/design/components/ui/Text.tsx`

```typescript
interface TextProps extends React.ComponentProps<typeof RNText> {
  variant?: keyof typeof textVariants; // ver seção 3.1
  color?: string; // override de cor semântica
  align?: "left" | "center" | "right";
  numberOfLines?: number;
  // Acessibilidade — nunca omitir em textos de alerta
  accessibilityRole?: "header" | "text" | "none";
}
```

**Variantes de uso crítico**:

```tsx
// Valor de glicemia em destaque
<Text variant="numericLg" color={theme.colors.glucose.critical}>254</Text>
<Text variant="unit" color={theme.colors.text.secondary}> mg/dL</Text>

// Instrução de emergência
<Text variant="emergency">Administre glucagon 1mg IM imediatamente.</Text>

// Label de campo de formulário
<Text variant="label" color={theme.colors.text.primary}>Dose de insulina (U)</Text>
```

---

### 9.2 Button

**Arquivo**: `src/design/components/ui/Button.tsx`

```typescript
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "emergency";
type ButtonSize = "sm" | "md" | "lg" | "emergency";

interface ButtonProps {
  variant?: ButtonVariant; // default: "primary"
  size?: ButtonSize; // default: "md"
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  // Acessibilidade obrigatória
  accessibilityLabel: string; // texto para screen reader (pode diferir do label visual)
  accessibilityHint?: string; // ação que ocorrerá ao pressionar
}
```

**Especificação por variante**:

| Variante    | Background                  | Text              | Border           | Shadow      | Uso                      |
| ----------- | --------------------------- | ----------------- | ---------------- | ----------- | ------------------------ |
| `primary`   | `primary.DEFAULT` (#2563EB) | white             | none             | `md`        | CTAs principais          |
| `secondary` | white                       | `primary.DEFAULT` | `primary.border` | `sm`        | Ação secundária          |
| `ghost`     | transparent                 | `primary.DEFAULT` | none             | none        | Ação terciária, links    |
| `danger`    | `error.DEFAULT` (#DC2626)   | white             | none             | `md`        | Revogação, exclusão      |
| `emergency` | `red600` (#DC2626)          | white             | `red700`         | `emergency` | Protocolos de emergência |

**Especificação por tamanho**:

| Size        | Height | Padding H | Font          | Min tap width |
| ----------- | ------ | --------- | ------------- | ------------- |
| `sm`        | 36     | 12        | `buttonSm`    | 44            |
| `md`        | 48     | 16        | `button`      | 44            |
| `lg`        | 56     | 20        | `button`      | 44            |
| `emergency` | 64     | 24        | `button`+bold | 100%          |

**Estado pressed**: `opacity: 0.85` + `scale: 0.98` com `duration.fast`.
**Estado loading**: spinner branco substitui conteúdo; botão permanece na mesma dimensão para evitar layout shift.
**Estado disabled**: `opacity: 0.4`, sem feedback tátil.

```tsx
// CTA de registro de dose
<Button
  variant="primary"
  size="lg"
  label="Registrar dose"
  onPress={handleRegister}
  accessibilityLabel="Confirmar registro de dose de insulina"
  accessibilityHint="Salva o registro localmente e enfileira para sincronização"
/>

// Botão de emergência — ocupar toda a largura disponível
<Button
  variant="emergency"
  size="emergency"
  label="Protocolo de emergência"
  onPress={openEmergencyModal}
  accessibilityLabel="Abrir protocolo de emergência para hipoglicemia grave"
  fullWidth
/>
```

---

### 9.3 Input

**Arquivo**: `src/design/components/ui/Input.tsx`

```typescript
type InputState = "default" | "focused" | "error" | "success" | "disabled";

interface InputProps extends React.ComponentProps<typeof TextInput> {
  label?: string;
  hint?: string; // texto auxiliar abaixo do campo
  error?: string; // mensagem de erro (undefined = sem erro)
  state?: InputState;
  leftElement?: React.ReactNode; // ícone ou prefixo (ex: símbolo de unidade)
  rightElement?: React.ReactNode; // ícone de limpar, olho de senha, etc.
  // Numéricos clínicos — sempre usar keyboardType apropriado
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address" | "phone-pad";
  // Acessibilidade
  accessibilityLabel: string;
  accessibilityHint?: string;
}
```

**Estados visuais**:

| State      | Border color                | Border width | Label color       |
| ---------- | --------------------------- | ------------ | ----------------- |
| `default`  | `border.DEFAULT` (slate200) | thin/1       | `text.secondary`  |
| `focused`  | `primary.DEFAULT`           | medium/1.5   | `primary.DEFAULT` |
| `error`    | `error.DEFAULT`             | medium/1.5   | `error.DEFAULT`   |
| `success`  | `success.DEFAULT`           | thin/1       | `success.DEFAULT` |
| `disabled` | `border.subtle`             | hairline     | `text.disabled`   |

**Campos numéricos clínicos** (dose, glicemia, carboidratos):

- `keyboardType="decimal-pad"` (iOS) / `"numeric"` (Android)
- Texto com variante `numeric` para legibilidade de valores
- Sufixo de unidade (`U`, `mg/dL`, `g`) como `rightElement` em variante `unit`
- Bounds exibidos como `hint`: ex: `"0.01 – 100 U"`

```tsx
<Input
  label="Dose de insulina"
  hint={`0,01 – 100 U · Dose máxima: ${INSULIN_DOSE_MAX_UNITS} U`}
  error={errors.doseUnits?.message}
  keyboardType="decimal-pad"
  rightElement={<Text variant="unit">U</Text>}
  accessibilityLabel="Campo de dose de insulina em unidades"
  accessibilityHint="Digite o valor entre 0,01 e 100"
  {...register("doseUnits")}
/>
```

---

### 9.4 Card

**Arquivo**: `src/design/components/ui/Card.tsx`

```typescript
type CardVariant = "default" | "elevated" | "outlined" | "severity";

interface CardProps {
  variant?: CardVariant;
  severity?: keyof typeof colors.severity; // apenas com variant="severity"
  onPress?: () => void; // torna o card interativo
  padding?: number; // override do padding interno (default: spacing[4])
  children: React.ReactNode;
  // Acessibilidade — obrigatório quando card é interativo
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "none";
}
```

| Variante   | Background                          | Border                             | Shadow |
| ---------- | ----------------------------------- | ---------------------------------- | ------ |
| `default`  | `surface.DEFAULT` (white)           | none                               | `sm`   |
| `elevated` | `surface.DEFAULT`                   | none                               | `md`   |
| `outlined` | `surface.DEFAULT`                   | `border.DEFAULT`                   | none   |
| `severity` | `colors.severity[severity].surface` | `colors.severity[severity].border` | `sm`   |

---

### 9.5 Badge

**Arquivo**: `src/design/components/ui/Badge.tsx`

```typescript
type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "severity" | "sync";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  severity?: keyof typeof colors.severity; // quando variant="severity"
  syncStatus?: SyncStatus; // quando variant="sync"
  size?: BadgeSize;
  icon?: React.ReactNode;
}
```

**Badges de severidade** (mapeados de `SeverityLevel` do domínio):

| SeverityLevel | Texto do badge | Cores                                        |
| ------------- | -------------- | -------------------------------------------- |
| `mild`        | Leve           | `severity.mild`                              |
| `moderate`    | Moderado       | `severity.moderate`                          |
| `severe`      | Grave          | `severity.severe`                            |
| `emergency`   | EMERGÊNCIA     | `severity.emergency` — texto uppercase, bold |

**Badges de sync** (mapeados de `SyncStatus`):

| SyncStatus | Texto        | Cor                    |
| ---------- | ------------ | ---------------------- |
| `pending`  | Pendente     | `sync.pending` (amber) |
| `synced`   | Sincronizado | `sync.synced` (green)  |
| `conflict` | Conflito     | `sync.conflict` (red)  |

---

### 9.6 Icon

**Arquivo**: `src/design/components/ui/Icon.tsx`

```typescript
// Biblioteca: @expo/vector-icons (Feather + MaterialIcons incluídos no Expo SDK)
type IconFamily = "Feather" | "MaterialIcons" | "MaterialCommunityIcons";

interface IconProps {
  name: string;
  family?: IconFamily; // default: "Feather"
  size?: keyof typeof sizes.icon; // default: "md" = 24
  color?: string; // default: theme.colors.text.primary
  // Acessibilidade — obrigatório quando ícone transmite informação
  accessibilityLabel?: string; // undefined = decorativo (aria-hidden)
}
```

**Ícones críticos de domínio** (não substituir sem revisão de acessibilidade):

| Contexto         | Ícone              | Family                 | Justificativa            |
| ---------------- | ------------------ | ---------------------- | ------------------------ |
| Insulina         | `"syringe"`        | MaterialCommunityIcons | Reconhecimento universal |
| Sintoma          | `"activity"`       | Feather                |                          |
| Alerta warning   | `"alert-triangle"` | Feather                |                          |
| Alerta crítico   | `"alert-octagon"`  | Feather                |                          |
| Emergência       | `"zap"`            | Feather                |                          |
| Glicemia         | `"droplet"`        | Feather                |                          |
| Offline          | `"wifi-off"`       | Feather                |                          |
| Sync             | `"refresh-cw"`     | Feather                |                          |
| Sync pendente    | `"clock"`          | Feather                |                          |
| Sync conflito    | `"git-merge"`      | Feather                |                          |
| Usuário/cuidador | `"user"`           | Feather                |                          |
| Paciente         | `"heart"`          | Feather                |                          |

---

### 9.7 Divider

**Arquivo**: `src/design/components/ui/Divider.tsx`

```typescript
interface DividerProps {
  orientation?: "horizontal" | "vertical"; // default: "horizontal"
  color?: string; // default: theme.colors.border.DEFAULT
  thickness?: number; // default: StyleSheet.hairlineWidth
  spacing?: number; // margin vertical (horizontal) — default: spacing[2]
  label?: string; // texto centralizado na linha (ex: "hoje")
}
```

---

### 9.8 EmptyState

**Arquivo**: `src/design/components/ui/EmptyState.tsx`

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
    accessibilityLabel: string;
  };
  // Estados específicos de domínio
  variant?: "default" | "offline" | "noRecords" | "noPatient" | "loadError";
}
```

**Variantes obrigatórias de domínio**:

| Variante    | Título sugerido               | Quando usar                        |
| ----------- | ----------------------------- | ---------------------------------- |
| `offline`   | "Sem conexão"                 | App offline sem dados em cache     |
| `noRecords` | "Nenhum registro ainda"       | Paciente sem histórico             |
| `noPatient` | "Nenhum paciente configurado" | Guardian sem PatientProfile criado |
| `loadError` | "Não foi possível carregar"   | Erro de rede recuperável           |

---

### 9.9 Skeleton

**Arquivo**: `src/design/components/ui/Skeleton.tsx`

```typescript
interface SkeletonProps {
  width?:   number | `${number}%`;  // default: "100%"
  height:   number;
  radius?:  keyof typeof radii;     // default: "md"
  // Animação: shimmer esquerda→direita com duration.slow
  animated?: boolean;  // default: true; false quando reduceMotion ativo
}

// Composição para card de registro
<Skeleton height={88} radius="lg" />   // DoseCard placeholder
<Skeleton height={20} width="60%" />   // linha de texto
<Skeleton height={16} width="40%" />   // metadado
```

---

## 10. Componentes de Domínio

> **Localização**: `src/design/components/domain/`
> **Regra**: podem importar tipos de `@sweetcare/shared-types` e `@sweetcare/shared-validation`.
> Não devem fazer chamadas de rede — recebem dados por props.

---

### 10.1 DoseCard

**Arquivo**: `src/design/components/domain/DoseCard.tsx`

Exibe um `InsulinApplicationRecord` de forma resumida na timeline.

```typescript
interface DoseCardProps {
  record: InsulinApplicationRecord;
  onPress?: () => void; // navegar para detalhe
  // Modo compacto para lista densa
  compact?: boolean;
}
```

**Layout** (modo padrão):

```
┌────────────────────────────────────────────────────┐
│  [ícone seringa]  Novorapid · meal_coverage   [sync badge]  │
│                   2,5 U · 45g carbs                         │
│                   Glicemia antes: 142 mg/dL                 │
│  14:32 · Abdomen  ─────────────────────── [chevron]  │
└────────────────────────────────────────────────────┘
```

**Regras visuais**:

- `doseRationale` mapeado para label legível: `"correction"→"Correção"`, `"meal_coverage"→"Refeição"`, `"basal"→"Basal"`, `"combination"→"Combinado"`
- `syncStatus` exibido como `Badge` no canto superior direito
- `glucoseBeforeMgdl` colorizado com token `glucose.*` se disponível
- `notes` truncado em 2 linhas com `numberOfLines={2}`
- Touch target mínimo: height ≥ 72 (conteúdo) + padding → total ≥ 88

---

### 10.2 GlucoseIndicator

**Arquivo**: `src/design/components/domain/GlucoseIndicator.tsx`

Exibe leitura de glicemia com contexto visual de risco.

```typescript
interface GlucoseIndicatorProps {
  valueMgdl: number | null;
  targetMin: number; // PatientProfile.targetGlucoseMinMgdl
  targetMax: number; // PatientProfile.targetGlucoseMaxMgdl
  recordedAt?: string; // ISO — exibir staleness se > 3h
  size?: "sm" | "md" | "lg"; // default: "md"
  // Modo de exibição
  variant?: "circle" | "inline" | "banner";
  showTrend?: boolean; // seta de tendência (dados wearable — Phase 6)
}
```

**Variante `circle`** (GlucoseIndicator padrão — tamanho 120pt):

```
        ╭──────────╮
        │   254    │  ← numericLg, cor = glucose.critical (#DC2626)
        │  mg/dL   │  ← unit, texto.secondary
        │ ↑ ALTO   │  ← label de estado, badge
        ╰──────────╯
```

**Variante `banner`** — barra horizontal de alerta (severity=emergency):

```
┌─ ATENÇÃO: Glicemia crítica ─ 254 mg/dL ─ Verifique imediatamente ─┐
```

**Mapeamento de cor** usa a tabela da seção 2.3.
**Staleness**: se `recordedAt` > 3 horas, exibir overlay com `"Último registro: Xh atrás"` em amber.

---

### 10.3 SymptomChecker

**Arquivo**: `src/design/components/domain/SymptomChecker.tsx`

Seletor de sintomas com feedback visual imediato de risco.

```typescript
interface SymptomCheckerProps {
  selectedCodes: SymptomCode[];
  onCodesChange: (codes: SymptomCode[]) => void;
  // Severidade calculada em tempo real com base nos códigos selecionados
  // Componente exibe pré-visualização de severidade
  onSeverityPreview?: (severity: SeverityLevel) => void;
}
```

**Layout**: grid de chips 2 colunas. Cada chip:

- Estado `unselected`: outlined, slate200
- Estado `selected`: fundo `severity.*` correspondente ao risco do sintoma
- Sintomas de emergência (`seizure`, `loss_of_consciousness`) destacados com borda vermelha e ícone de urgência

**Mapeamento de risco por sintoma** (usado para colorizar seleção e calcular `SeverityLevel`):

| SymptomCode             | Risco sugerido | Justificativa clínica             |
| ----------------------- | -------------- | --------------------------------- |
| `hypoglycemia_mild`     | moderate       | Requer ação mas não emergência    |
| `tremor`                | moderate       | Sinal de hipoglicemia em evolução |
| `confusion`             | severe         | Comprometimento de SNC            |
| `loss_of_consciousness` | emergency      | Protocolo imediato                |
| `seizure`               | emergency      | Protocolo imediato                |
| `hyperglycemia`         | moderate       | Monitorar, pode escalar           |
| `ketoacidosis_risk`     | severe         | Risco de CAD                      |
| `excessive_thirst`      | mild           | Sinal de hiperglicemia crônica    |
| `frequent_urination`    | mild           | Sinal de hiperglicemia crônica    |
| `fatigue`               | mild           | Inespecífico                      |

> A severidade final é determinada pelo sintoma de maior risco entre os selecionados.
> A API valida e persiste a `severity_level` escolhida pelo cuidador — a UI sugere, mas não impõe.

---

## 11. Componentes de Layout

> **Localização**: `src/design/components/layout/`

---

### 11.1 Screen

**Arquivo**: `src/design/components/layout/Screen.tsx`

Wrapper de tela padrão. Toda tela do app usa este componente como root.

```typescript
interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean; // default: false — usa ScrollView se true
  padded?: boolean; // default: true — aplica paddingHorizontal: 16
  safeArea?: boolean; // default: true — useSafeAreaInsets
  refreshControl?: React.ReactElement; // pull-to-refresh
  // Estado de tela
  loading?: boolean; // exibe skeleton fullscreen
  error?: Error | null; // exibe EmptyState variant="loadError"
  offline?: boolean; // exibe banner de offline no topo
  // Emergência — altera o background da tela
  emergency?: boolean; // background: colors.background.emergency
}
```

**Banner offline** (exibido automaticamente quando `offline=true`):

```
┌─ [wifi-off] Modo offline · Registros serão sincronizados ao reconectar ─┐
```

- Background: `amber50`, border bottom: `amber200`
- Texto variante `caption`, cor `amber700`
- Não bloqueia conteúdo — apenas aviso contextual

---

### 11.2 Header

**Arquivo**: `src/design/components/layout/Header.tsx`

Header de tela dentro da navegação de tabs (não o header do Stack navigator nativo).

```typescript
interface HeaderProps {
  title: string;
  subtitle?: string; // ex: nome do paciente ativo
  leftAction?: {
    icon: string;
    onPress: () => void;
    accessibilityLabel: string;
  };
  rightAction?: {
    icon?: string;
    label?: string;
    onPress: () => void;
    accessibilityLabel: string;
    badge?: number; // notificação numérica (ex: conflitos pendentes)
  };
  // Estados
  syncStatus?: SyncStatus; // indicador de sync no header
  offline?: boolean;
  // Variante de emergência
  emergency?: boolean; // fundo red600, texto branco
}
```

---

## 12. Utils — Haptics

**Arquivo**: `src/design/utils/haptics.ts`

```typescript
import * as ExpoHaptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

// Centraliza feedback tátil — toda chamada de haptic passa por aqui
// para suportar redução global (usuários com sensibilidade a vibração)

export const haptics = {
  // Interações padrão
  light(): void {
    trigger("light");
  }, // toggle, seleção de chip
  medium(): void {
    trigger("medium");
  }, // botão primário, confirmação
  heavy(): void {
    trigger("heavy");
  }, // ação destrutiva, submit crítico

  // Feedback semântico
  success(): void {
    trigger("notification", "success");
  }, // registro salvo
  warning(): void {
    trigger("notification", "warning");
  }, // conflito de sync
  error(): void {
    trigger("notification", "error");
  }, // falha de validação

  // Emergência — padrão de 3 pulsos curtos (universal de atenção)
  emergency(): void {
    trigger("heavy");
    setTimeout(() => trigger("heavy"), 200);
    setTimeout(() => trigger("heavy"), 400);
  },
};

async function trigger(
  type: "light" | "medium" | "heavy",
  notificationType?: "success" | "warning" | "error",
): Promise<void> {
  // Respeitar preferência do usuário
  const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
  if (reduceMotion) return;

  if (notificationType) {
    const map = {
      success: ExpoHaptics.NotificationFeedbackType.Success,
      warning: ExpoHaptics.NotificationFeedbackType.Warning,
      error: ExpoHaptics.NotificationFeedbackType.Error,
    };
    await ExpoHaptics.notificationAsync(map[notificationType]);
    return;
  }

  const map = {
    light: ExpoHaptics.ImpactFeedbackStyle.Light,
    medium: ExpoHaptics.ImpactFeedbackStyle.Medium,
    heavy: ExpoHaptics.ImpactFeedbackStyle.Heavy,
  };
  await ExpoHaptics.impactAsync(map[type]);
}
```

**Mapeamento de ação → haptic**:

| Ação do usuário                 | Haptic      | Justificativa                  |
| ------------------------------- | ----------- | ------------------------------ |
| Selecionar chip de sintoma      | `light`     | Seleção leve                   |
| Pressionar botão primário       | `medium`    | Confirmação de ação            |
| Confirmar registro de dose      | `success`   | Feedback positivo claro        |
| Botão de emergência             | `emergency` | Alerta tátil imediato          |
| Erro de validação de formulário | `error`     | Feedback sem precisar ver tela |
| Conflito de sync detectado      | `warning`   | Atenção sem alarme             |
| Deslizar para deletar           | `medium`    | Ação significativa             |
| Resolver conflito de sync       | `success`   | Conclusão de tarefa            |

---

## 13. Acessibilidade

### 13.1 Requisitos Obrigatórios (WCAG 2.1 AA + CLAUDE.md)

| Requisito                         | Valor       | Escopo                                                 |
| --------------------------------- | ----------- | ------------------------------------------------------ |
| Contraste mínimo — texto normal   | 4.5:1       | Todos os textos `fontSize < 18`                        |
| Contraste mínimo — texto grande   | 3:1         | `fontSize ≥ 18` ou bold ≥ 14                           |
| Contraste mínimo — elementos UI   | 3:1         | Bordas de input, ícones informativos                   |
| Touch target mínimo               | 44 × 44pt   | Todos os elementos interativos                         |
| Touch target recomendado (tabs)   | 56 × 56pt   | Barra de navegação inferior                            |
| Touch target emergência           | 64 × 64pt   | Botões de protocolo de emergência                      |
| Tamanho de fonte mínimo (alertas) | 16sp        | Textos em alertas e instruções médicas                 |
| Tamanho de fonte mínimo geral     | 14sp        | Qualquer texto legível                                 |
| Screen reader                     | Obrigatório | `accessibilityLabel` em todos os elementos interativos |

### 13.2 Contraste das Cores Principais

| Par de cores              | Contraste | Uso                                 |
| ------------------------- | --------- | ----------------------------------- |
| white / blue600 (#2563EB) | 5.9:1 ✅  | Botão primário                      |
| white / red600 (#DC2626)  | 5.25:1 ✅ | Botão emergência                    |
| slate900 / white          | 16.1:1 ✅ | Texto principal                     |
| slate900 / slate50        | 15.8:1 ✅ | Texto sobre fundo padrão            |
| slate600 / white          | 7.0:1 ✅  | Texto secundário                    |
| red600 / red50            | 5.8:1 ✅  | Texto de erro sobre fundo de erro   |
| amber700 / amber50        | 5.1:1 ✅  | Texto de aviso sobre fundo de aviso |
| green700 / green50        | 6.8:1 ✅  | Texto de sucesso                    |

### 13.3 Labels de Screen Reader — Padrões

```typescript
// DoseCard — descrever conteúdo clínico completo
accessibilityLabel={
  `Registro de insulina. ${record.insulinType}, ${record.doseUnits} unidades,
   ${rationaleLabel}. ${glucoseLabel}. ${timeLabel}. Sincronização: ${syncLabel}.`
}

// GlucoseIndicator — incluir interpretação clínica
accessibilityLabel={
  `Glicemia: ${valueMgdl} miligramas por decilitro. ${statusLabel}. Lido às ${timeLabel}.`
}

// Botão de emergência
accessibilityLabel="Abrir protocolo de emergência"
accessibilityHint="Abre instruções de resposta a hipoglicemia grave em tela cheia"

// Chip de sintoma
accessibilityLabel={`Sintoma: ${symptomLabel}. ${selected ? "Selecionado" : "Não selecionado"}`}
accessibilityRole="checkbox"
accessibilityState={{ checked: selected }}
```

### 13.4 Reduced Motion

```typescript
// Em todo componente com animação — padrão obrigatório
const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
  return () => sub.remove();
}, []);

// Substituir duração de animação
const animDuration = reduceMotion ? duration.instant : duration.normal;
```

---

## 14. Estados Globais de UI

### 14.1 Estados de Tela por Rota

| Tela               | Estado offline                               | Estado loading       | Estado emergência |
| ------------------ | -------------------------------------------- | -------------------- | ----------------- |
| `(tabs)/index`     | Banner + dados cacheados                     | Skeleton de timeline | —                 |
| `(tabs)/log`       | Banner + formulário habilitado (salva local) | —                    | —                 |
| `(tabs)/insights`  | Banner + dados cacheados ou EmptyState       | Skeleton de card     | —                 |
| `alerts/[alertId]` | Dados cacheados; sem ações destrutivas       | Skeleton             | Header red600     |
| `emergency`        | Funciona offline (instruções hardcoded)      | —                    | Tela toda red900  |

### 14.2 Fluxo Visual de Sync

```
Registro offline criado
        ↓
Badge pending (amber) no DoseCard + header
        ↓
[App reconecta — sync dispara]
        ↓
Badge pending → spinner no header
        ↓
   ┌────┴────┐
  sucesso  conflito
   ↓           ↓
Badge synced  Badge conflict (red)
(green)       + haptics.warning()
              + Banner "X conflito(s) pendentes"
```

---

## 15. Referência de Implementação

### 15.1 Estrutura de Arquivos

```
apps/mobile/src/design/
├── themes/
│   ├── tokens.ts          ← re-exports de todos os tokens (barrel)
│   ├── colors.ts          ← palette + colors semânticos
│   ├── typography.ts      ← fontSizes, weights, lineHeights, letterSpacings
│   ├── spacing.ts         ← spacing, touchTargets, radii, borderWidths
│   ├── shadows.ts         ← shadows por elevação + semânticos
│   ├── motion.ts          ← duration, easing, transitions
│   └── layout.ts          ← grid, sizes fixos, screen dimensions
├── contexts/
│   └── ThemeContext.tsx   ← Provider + hook useTheme()
├── components/
│   ├── ui/
│   │   ├── Text.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Icon.tsx
│   │   ├── Divider.tsx
│   │   ├── EmptyState.tsx
│   │   └── Skeleton.tsx
│   ├── domain/
│   │   ├── DoseCard.tsx
│   │   ├── GlucoseIndicator.tsx
│   │   └── SymptomChecker.tsx
│   └── layout/
│       ├── Screen.tsx
│       └── Header.tsx
└── utils/
    └── haptics.ts
```

### 15.2 Ordem de Implementação Recomendada

1. **tokens/** — nenhuma dependência, testar com snapshot
2. **ThemeContext** — depende de tokens
3. **Text, Icon, Divider** — mais simples, sem estado
4. **Skeleton** — necessário para loading states de outros componentes
5. **Badge** — depende de tokens de severidade/sync
6. **Button, Input** — componentes de formulário
7. **Card, EmptyState** — composição de anteriores
8. **Screen, Header** — layout, composição de todos anteriores
9. **GlucoseIndicator** — domínio, depende de Text, Icon, Badge
10. **SymptomChecker** — domínio mais complexo, depende de Badge, haptics
11. **DoseCard** — composição de todos os ui + Badge + domain types
12. **haptics.ts** — utilitário independente, pode ser implementado a qualquer momento

### 15.3 Convenções de Estilo

```typescript
// ✅ StyleSheet.create com tema — sempre via hook
const useStyles = () => {
  const { theme } = useTheme();
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.DEFAULT,
      padding: theme.spacing[4],
      borderRadius: theme.radii.lg,
    },
  });
};

// ❌ Nunca valores literais inline sem token
style={{ backgroundColor: "#2563EB", padding: 16 }}

// ✅ Valores numéricos clínicos sempre com formatação
const formatGlucose = (v: number) => v.toFixed(0);   // sem casas decimais
const formatDose    = (v: number) => v.toFixed(2);   // 2 casas (0,01 U precisão)
const formatCarbs   = (v: number) => `${v}g`;

// ✅ Timestamps — sempre timezone-aware (appliedAt e observedAt são ISO com offset)
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
const formatTime = (iso: string) => format(new Date(iso), "HH:mm", { locale: ptBR });
```

### 15.4 Dependências do Design System

| Pacote                           | Versão          | Propósito                         |
| -------------------------------- | --------------- | --------------------------------- |
| `expo-haptics`                   | SDK 52          | Feedback tátil (via `haptics.ts`) |
| `@expo/vector-icons`             | SDK 52          | Ícones Feather + MaterialIcons    |
| `expo-constants`                 | SDK 52          | Informações de device para layout |
| `react-native-safe-area-context` | incluído SDK 52 | useSafeAreaInsets em Screen       |
| `date-fns`                       | ^3.0            | Formatação de timestamps clínicos |

> Nenhuma biblioteca de design system de terceiros (ex: Tamagui, NativeBase, Gluestack).
> O design system é 100% próprio para garantir controle total sobre tokens de emergência,
> acessibilidade clínica e comportamento offline.

---

_Documento gerado em: 2026-05-27 · Versão: 1.0.0_
_Próxima revisão obrigatória: ao implementar dark mode (v2) ou adicionar componentes de US2 (Alerts)_
