import React, { createContext, useContext } from "react";
import { colors } from "../themes/colors.js";
import { spacing, radii, borderWidths, touchTargets } from "../themes/spacing.js";
import { shadows } from "../themes/shadows.js";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  textVariants,
} from "../themes/typography.js";
import { transitions } from "../themes/motion.js";
import { sizes } from "../themes/layout.js";

const theme = {
  colors,
  spacing,
  radii,
  borderWidths,
  touchTargets,
  shadows,
  typography: { fontSizes, fontWeights, lineHeights, letterSpacings, textVariants },
  motion: transitions,
  layout: sizes,
  dark: false,
} as const;

export type Theme = typeof theme;

const ThemeContext = createContext<{ theme: Theme; isDark: boolean } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={{ theme, isDark: false }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
