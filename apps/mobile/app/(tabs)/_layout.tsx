import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563EB",
        headerShown: false,
        // Large touch targets for emergency accessibility (min 44pt)
        tabBarItemStyle: { minHeight: 56 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarAccessibilityLabel: "Tela inicial com resumo do paciente",
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Registrar",
          tabBarAccessibilityLabel: "Registrar insulina ou sintoma",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarAccessibilityLabel: "Ver insights e relatórios",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarAccessibilityLabel: "Configurações da conta",
        }}
      />
    </Tabs>
  );
}
