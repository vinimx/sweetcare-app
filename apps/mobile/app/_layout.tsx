import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Offline mutation retry: only retry network errors, not validation errors
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("4")) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="alerts/[alertId]"
          options={{
            title: "Alerta",
            presentation: "modal",
            headerStyle: { backgroundColor: "#DC2626" },
            headerTintColor: "#fff",
          }}
        />
        <Stack.Screen
          name="emergency"
          options={{
            title: "Protocolo de Emergência",
            presentation: "fullScreenModal",
            headerStyle: { backgroundColor: "#7F1D1D" },
            headerTintColor: "#fff",
            gestureEnabled: false,
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
