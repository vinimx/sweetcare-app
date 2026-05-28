import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "../ui/Text.js";
import { Icon } from "../ui/Icon.js";
import { Badge } from "../ui/Badge.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { SyncStatus } from "@sweetcare/shared-types";

interface HeaderAction {
  icon?: string;
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  syncStatus?: SyncStatus;
  offline?: boolean;
  emergency?: boolean;
}

export function Header({
  title,
  subtitle,
  leftAction,
  rightAction,
  syncStatus,
  offline,
  emergency,
}: HeaderProps) {
  const { theme } = useTheme();

  const bg = emergency ? theme.colors.error.DEFAULT : theme.colors.surface.DEFAULT;
  const titleColor = emergency ? theme.colors.text.inverse : theme.colors.text.primary;
  const subtitleColor = emergency ? "rgba(255,255,255,0.8)" : theme.colors.text.secondary;
  const iconColor = emergency ? theme.colors.text.inverse : theme.colors.text.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderBottomColor: emergency ? "transparent" : theme.colors.border.subtle,
        },
        theme.shadows.sm,
      ]}
    >
      <View style={styles.left}>
        {leftAction && (
          <TouchableOpacity
            onPress={leftAction.onPress}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={leftAction.accessibilityLabel}
            hitSlop={styles.hitSlop}
          >
            {leftAction.icon && <Icon name={leftAction.icon} color={iconColor} />}
            {leftAction.label && (
              <Text variant="body" color={iconColor}>
                {leftAction.label}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        <Text variant="h4" color={titleColor} numberOfLines={1} align="center">
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color={subtitleColor} numberOfLines={1} align="center">
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {syncStatus && !offline && (
          <Badge
            variant="sync"
            syncStatus={syncStatus}
            label={syncStatus === "pending" ? "Sync" : syncStatus === "conflict" ? "Conflito" : ""}
          />
        )}
        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
            hitSlop={styles.hitSlop}
          >
            {rightAction.icon && (
              <View>
                <Icon name={rightAction.icon} color={iconColor} />
                {(rightAction.badge ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.colors.error.DEFAULT }]}>
                    <Text
                      variant="caption"
                      color={theme.colors.text.inverse}
                      style={styles.badgeText}
                    >
                      {String(rightAction.badge)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {rightAction.label && (
              <Text variant="body" color={iconColor}>
                {rightAction.label}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flex: 1, alignItems: "flex-start" },
  center: { flex: 2, alignItems: "center" },
  right: {
    flex: 1,
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  action: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
});
