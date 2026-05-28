import { Easing } from "react-native";

export const duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0.0, 0, 1.0),
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  emphasis: Easing.bezier(0.2, 0.0, 0, 1.0),
  linear: Easing.linear,
} as const;

export const transitions = {
  fade: { duration: duration.normal, easing: easing.standard },
  slideUp: { duration: duration.slow, easing: easing.decelerate },
  press: { duration: duration.fast, easing: easing.accelerate },
  emergencyPulse: { duration: 800, iterations: -1, easing: easing.emphasis },
} as const;

export const reducedMotionFallback = {
  duration: duration.fast,
  easing: easing.linear,
} as const;
