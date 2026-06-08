import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/design/contexts/ThemeContext.js";
import { AuthProvider, useAuth } from "../src/infrastructure/auth/AuthContext.js";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        if (error instanceof Error && /^4/.test(error.message)) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const splashHidden = React.useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!splashHidden.current) {
      splashHidden.current = true;
      void SplashScreen.hideAsync().catch(() => undefined);
    }
    const inAuth = segments[0] === "auth";
    if (!isAuthenticated && !inAuth) {
      router.replace("/auth/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, segments, router]);

  if (isLoading) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen
                name="patients/new"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Novo Paciente",
                }}
              />
              <Stack.Screen
                name="patients/edit/[id]"
                options={{
                  headerShown: true,
                  title: "Editar Paciente",
                }}
              />
              <Stack.Screen
                name="alerts/[alertId]"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Alerta",
                  headerStyle: { backgroundColor: "#DC2626" },
                  headerTintColor: "#fff",
                }}
              />
              <Stack.Screen
                name="emergency"
                options={{
                  presentation: "fullScreenModal",
                  headerShown: true,
                  title: "Protocolo de Emergência",
                  headerStyle: { backgroundColor: "#7F1D1D" },
                  headerTintColor: "#fff",
                  gestureEnabled: false,
                }}
              />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
