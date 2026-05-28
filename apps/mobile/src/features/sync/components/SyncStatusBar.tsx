import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { countPendingRecords } from "../../../infrastructure/storage/offline-db.js";
import { runSync } from "../../../infrastructure/sync/sync-engine.js";

interface Props {
  patientId: string;
  onConflictsPress?: () => void;
}

type SyncState = "idle" | "syncing" | "error";

export default function SyncStatusBar({ patientId, onConflictsPress }: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastConflicts, setLastConflicts] = useState(0);

  const refreshPending = useCallback(async () => {
    const count = await countPendingRecords(patientId);
    setPendingCount(count);
  }, [patientId]);

  useEffect(() => {
    void refreshPending();
    const interval = setInterval(() => void refreshPending(), 15_000);
    return () => {
      clearInterval(interval);
    };
  }, [refreshPending]);

  const handleSync = async () => {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    try {
      const result = await runSync(patientId);
      setLastConflicts(result.conflicts);
      await refreshPending();
      setSyncState("idle");
    } catch {
      setSyncState("error");
      setTimeout(() => {
        setSyncState("idle");
      }, 4000);
    }
  };

  if (pendingCount === 0 && syncState === "idle" && lastConflicts === 0) {
    return null;
  }

  return (
    <View
      style={[styles.bar, syncState === "error" && styles.barError]}
      accessibilityRole="status"
      accessibilityLabel={`${String(pendingCount)} registros pendentes de sincronização`}
    >
      {syncState === "syncing" ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>Sincronizando…</Text>
        </View>
      ) : syncState === "error" ? (
        <Text style={styles.text}>Falha ao sincronizar. Tente novamente.</Text>
      ) : (
        <View style={styles.row}>
          {pendingCount > 0 && (
            <Text style={styles.text}>
              {pendingCount} {pendingCount === 1 ? "registro pendente" : "registros pendentes"}
            </Text>
          )}
          {lastConflicts > 0 && (
            <TouchableOpacity
              onPress={onConflictsPress}
              accessibilityRole="button"
              accessibilityLabel={`${String(lastConflicts)} conflitos de sincronização. Toque para resolver.`}
              style={styles.conflictBadge}
            >
              <Text style={styles.conflictText}>
                {lastConflicts} conflito{lastConflicts > 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          )}
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={() => {
                void handleSync();
              }}
              style={styles.syncButton}
              accessibilityRole="button"
              accessibilityLabel="Sincronizar agora"
            >
              <Text style={styles.syncButtonText}>Sincronizar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  barError: { backgroundColor: "#DC2626" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1 },
  conflictBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 32,
    justifyContent: "center",
  },
  conflictText: { color: "#92400E", fontSize: 13, fontWeight: "700" },
  syncButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  syncButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
