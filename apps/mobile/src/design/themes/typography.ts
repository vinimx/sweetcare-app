export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const lineHeights = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const letterSpacings = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1.0,
} as const;

export const textVariants = {
  display: {
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["4xl"] * lineHeights.tight,
  },
  h1: {
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["3xl"] * lineHeights.tight,
  },
  h2: {
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes["2xl"] * lineHeights.snug,
  },
  h3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.snug,
  },
  h4: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.snug,
  },
  bodyLg: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.lg * lineHeights.normal,
  },
  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.md * lineHeights.normal,
  },
  bodySm: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.snug,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.xs * lineHeights.snug,
  },
  numeric: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.lg * lineHeights.tight,
  },
  numericLg: {
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["3xl"] * lineHeights.tight,
  },
  unit: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.snug,
    letterSpacing: letterSpacings.wider,
  },
  emergency: {
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["2xl"] * lineHeights.relaxed,
  },
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.tight,
  },
  buttonSm: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.sm * lineHeights.tight,
  },
} as const;
