import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../src/design/contexts/ThemeContext.js";

function TabIcon({ name, color }: { name: string; color: string }) {
  return <Feather name={name as never} size={22} color={color} />;
}

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary.DEFAULT,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface.DEFAULT,
          borderTopColor: theme.colors.border.subtle,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarItemStyle: { minHeight: 56 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          tabBarAccessibilityLabel: "Tela inicial com resumo do paciente",
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Registrar",
          tabBarIcon: ({ color }) => <TabIcon name="plus-circle" color={color} />,
          tabBarAccessibilityLabel: "Registrar insulina ou sintoma",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <TabIcon name="bar-chart-2" color={color} />,
          tabBarAccessibilityLabel: "Ver insights e relatórios de IA",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
          tabBarAccessibilityLabel: "Perfil e configurações da conta",
        }}
      />
    </Tabs>
  );
}
