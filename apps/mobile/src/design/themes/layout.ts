import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const grid = {
  columns: 4,
  gutter: 16,
  margin: 16,
  columnWidth: (SCREEN_WIDTH - 32 - 3 * 16) / 4,
} as const;

export const sizes = {
  tabBar: { height: 56, iconSize: 24 },
  header: { height: 56, compact: 44 },
  input: { height: 48, heightSm: 40, heightLg: 56 },
  button: { heightSm: 36, height: 48, heightLg: 56, heightEmergency: 64 },
  icon: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32, "2xl": 48, emergency: 56 },
  avatar: { sm: 32, md: 40, lg: 56 },
  patientBadge: { size: 36 },
  glucoseDisplay: { circleSize: 120, fontSize: 30 },
  toast: { maxWidth: SCREEN_WIDTH - 32 },
  screen: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
} as const;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
