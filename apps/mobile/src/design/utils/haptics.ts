import * as ExpoHaptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

export const haptics = {
  light(): void {
    void trigger("light");
  },
  medium(): void {
    void trigger("medium");
  },
  heavy(): void {
    void trigger("heavy");
  },
  success(): void {
    void trigger("notification", "success");
  },
  warning(): void {
    void trigger("notification", "warning");
  },
  error(): void {
    void trigger("notification", "error");
  },
  emergency(): void {
    void trigger("heavy");
    setTimeout(() => void trigger("heavy"), 200);
    setTimeout(() => void trigger("heavy"), 400);
  },
};

async function trigger(
  type: "light" | "medium" | "heavy" | "notification",
  notificationType?: "success" | "warning" | "error",
): Promise<void> {
  try {
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    if (reduceMotion) return;

    if (type === "notification" && notificationType) {
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
      notification: ExpoHaptics.ImpactFeedbackStyle.Medium,
    };
    await ExpoHaptics.impactAsync(map[type]);
  } catch {
    // Haptics unavailable on simulator/some devices
  }
}
