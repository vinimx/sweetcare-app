import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  type ViewStyle,
  type RefreshControlProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../ui/Text.js";
import { Icon } from "../ui/Icon.js";
import { EmptyState } from "../ui/EmptyState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useTheme } from "../../contexts/ThemeContext.js";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  safeArea?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  loading?: boolean;
  error?: Error | null;
  offline?: boolean;
  emergency?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

function OfflineBanner() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.offlineBanner,
        {
          backgroundColor: theme.colors.warning.surface,
          borderBottomColor: theme.colors.warning.border,
        },
      ]}
    >
      <Icon name="wifi-off" size="sm" color={theme.colors.warning.DEFAULT} />
      <Text variant="caption" color={theme.colors.warning.DEFAULT} style={styles.offlineText}>
        Modo offline · Registros serão sincronizados ao reconectar
      </Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[88, 88, 72, 88, 72].map((h, i) => (
        <Skeleton key={i} height={h} radius="lg" style={styles.skeletonItem} />
      ))}
    </View>
  );
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  safeArea = true,
  refreshControl,
  loading = false,
  error = null,
  offline = false,
  emergency = false,
  style,
  contentStyle,
}: ScreenProps) {
  const { theme } = useTheme();

  const bg = emergency ? theme.colors.background.emergency : theme.colors.background.DEFAULT;
  const padding = padded ? { paddingHorizontal: theme.layout.screen.paddingHorizontal } : {};

  const content = loading ? (
    <LoadingSkeleton />
  ) : error ? (
    <EmptyState variant="loadError" message={error.message} />
  ) : (
    children
  );

  const Wrapper = safeArea ? SafeAreaView : View;

  if (scroll) {
    return (
      <Wrapper style={[styles.flex, { backgroundColor: bg }, style]}>
        {offline && <OfflineBanner />}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      </Wrapper>
    );
  }

  return (
    <Wrapper style={[styles.flex, { backgroundColor: bg }, style]}>
      {offline && <OfflineBanner />}
      <View style={[styles.flex, padding, contentStyle]}>{content}</View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  offlineText: { flex: 1 },
  skeletonWrap: { padding: 16, gap: 12 },
  skeletonItem: {},
});
