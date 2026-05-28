import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Phase 3 (US1): replace with PatientTimelineFeed component
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          SweetCare
        </Text>
        <Text style={styles.subtitle}>Plataforma de cuidado para crianças com Diabetes Tipo 1</Text>
        <Text style={styles.placeholder}>Implementação da timeline — Fase 3 (US1)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  placeholder: { fontSize: 14, color: "#9CA3AF", fontStyle: "italic" },
});
