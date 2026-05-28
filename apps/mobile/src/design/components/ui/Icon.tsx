import React from "react";
import { Feather, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { sizes } from "../../themes/layout.js";

type IconFamily = "Feather" | "MaterialIcons" | "MaterialCommunityIcons";

interface IconProps {
  name: string;
  family?: IconFamily;
  size?: keyof typeof sizes.icon;
  color?: string;
  accessibilityLabel?: string;
}

export function Icon({
  name,
  family = "Feather",
  size = "lg",
  color,
  accessibilityLabel,
}: IconProps) {
  const { theme } = useTheme();
  const iconSize = theme.layout.icon[size];
  const iconColor = color ?? theme.colors.text.primary;
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityLabel }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no" as const,
      };

  if (family === "MaterialIcons") {
    return <MaterialIcons name={name as never} size={iconSize} color={iconColor} {...a11y} />;
  }
  if (family === "MaterialCommunityIcons") {
    return (
      <MaterialCommunityIcons name={name as never} size={iconSize} color={iconColor} {...a11y} />
    );
  }
  return <Feather name={name as never} size={iconSize} color={iconColor} {...a11y} />;
}
