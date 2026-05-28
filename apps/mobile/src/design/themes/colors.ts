export const palette = {
  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue200: "#BFDBFE",
  blue300: "#93C5FD",
  blue400: "#60A5FA",
  blue500: "#3B82F6",
  blue600: "#2563EB",
  blue700: "#1D4ED8",
  blue800: "#1E40AF",
  blue900: "#1E3A8A",

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

  green50: "#F0FDF4",
  green100: "#DCFCE7",
  green200: "#BBF7D0",
  green500: "#22C55E",
  green600: "#16A34A",
  green700: "#15803D",
  green900: "#14532D",

  amber50: "#FFFBEB",
  amber100: "#FEF3C7",
  amber200: "#FDE68A",
  amber500: "#F59E0B",
  amber600: "#D97706",
  amber700: "#B45309",
  amber900: "#78350F",

  orange50: "#FFF7ED",
  orange100: "#FFEDD5",
  orange200: "#FED7AA",
  orange500: "#F97316",
  orange600: "#EA580C",
  orange700: "#C2410C",

  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red200: "#FECACA",
  red400: "#F87171",
  red500: "#EF4444",
  red600: "#DC2626",
  red700: "#B91C1C",
  red800: "#991B1B",
  red900: "#7F1D1D",

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;

export const colors = {
  primary: {
    DEFAULT: palette.blue600,
    light: palette.blue400,
    dark: palette.blue700,
    surface: palette.blue50,
    border: palette.blue200,
  },

  glucose: {
    normal: palette.green600,
    normalSurface: palette.green50,
    normalBorder: palette.green200,
    high: palette.amber600,
    highSurface: palette.amber50,
    highBorder: palette.amber200,
    low: palette.orange600,
    lowSurface: palette.orange50,
    lowBorder: palette.orange200,
    critical: palette.red600,
    criticalSurface: palette.red50,
    criticalBorder: palette.red200,
    unknown: palette.slate400,
    unknownSurface: palette.slate100,
  },

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
      surface: palette.red600,
      border: palette.red700,
      icon: palette.white,
    },
  },

  alert: {
    warning: { bg: palette.amber50, border: palette.amber500, icon: palette.amber600 },
    critical: { bg: palette.red50, border: palette.red500, icon: palette.red600 },
    emergency: { bg: palette.red600, border: palette.red700, icon: palette.white },
  },

  sync: {
    pending: { color: palette.amber600, surface: palette.amber50 },
    synced: { color: palette.green600, surface: palette.green50 },
    conflict: { color: palette.red600, surface: palette.red50 },
  },

  success: { DEFAULT: palette.green600, surface: palette.green50, border: palette.green200 },
  warning: { DEFAULT: palette.amber600, surface: palette.amber50, border: palette.amber200 },
  error: { DEFAULT: palette.red600, surface: palette.red50, border: palette.red200 },
  info: { DEFAULT: palette.blue600, surface: palette.blue50, border: palette.blue200 },

  background: {
    DEFAULT: palette.slate50,
    elevated: palette.white,
    emergency: palette.red900,
  },
  surface: {
    DEFAULT: palette.white,
    subtle: palette.slate50,
    overlay: "rgba(15, 23, 42, 0.5)",
  },

  text: {
    primary: palette.slate900,
    secondary: palette.slate600,
    tertiary: palette.slate400,
    disabled: palette.slate300,
    inverse: palette.white,
    link: palette.blue600,
    error: palette.red600,
  },

  border: {
    DEFAULT: palette.slate200,
    subtle: palette.slate100,
    strong: palette.slate300,
  },
} as const;
