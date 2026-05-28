import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { tokenStorage } from "../storage/secure-storage.js";
import { apiClient, setRefreshListener } from "../api/client.js";
import type { User, PatientProfile, AuthTokens } from "@sweetcare/shared-types";

const ACTIVE_PATIENT_KEY = "sc_active_patient_id";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  activePatient: PatientProfile | null;
  activePatientId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; display_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  setActivePatient: (patient: PatientProfile) => Promise<void>;
  refreshPatient: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    activePatient: null,
    activePatientId: null,
  });

  const loadStoredSession = useCallback(async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const user = await apiClient.get<User>("/users/me");
      const patientId = await SecureStore.getItemAsync(ACTIVE_PATIENT_KEY);
      let patient: PatientProfile | null = null;
      if (patientId) {
        patient = await apiClient.get<PatientProfile>(`/patients/${patientId}`).catch(() => null);
      }
      setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        activePatient: patient,
        activePatientId: patientId,
      });
    } catch {
      await tokenStorage.clearAll();
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        activePatient: null,
        activePatientId: null,
      });
    }
  }, []);

  useEffect(() => {
    void loadStoredSession();
  }, [loadStoredSession]);

  useEffect(() => {
    setRefreshListener(async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const data = await apiClient.post<AuthTokens>("/auth/refresh", {}, false);
        await tokenStorage.saveAccessToken(data.accessToken);
        return data.accessToken;
      } catch {
        await tokenStorage.clearAll();
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          activePatient: null,
          activePatientId: null,
        });
        return null;
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiClient.post<AuthTokens & { user: User }>(
      "/auth/login",
      { email, password },
      false,
    );
    await tokenStorage.saveAccessToken(data.accessToken);
    setState((s) => ({ ...s, isAuthenticated: true, user: data.user }));
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; display_name: string }) => {
      const data = await apiClient.post<AuthTokens & { user: User }>(
        "/auth/register",
        { ...input, role: "guardian" },
        false,
      );
      await tokenStorage.saveAccessToken(data.accessToken);
      setState((s) => ({ ...s, isAuthenticated: true, user: data.user }));
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout", {});
    } catch {
      /* best effort */
    }
    await tokenStorage.clearAll();
    await SecureStore.deleteItemAsync(ACTIVE_PATIENT_KEY);
    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      activePatient: null,
      activePatientId: null,
    });
  }, []);

  const setActivePatient = useCallback(async (patient: PatientProfile) => {
    await SecureStore.setItemAsync(ACTIVE_PATIENT_KEY, patient.id);
    setState((s) => ({ ...s, activePatient: patient, activePatientId: patient.id }));
  }, []);

  const refreshPatient = useCallback(async () => {
    const { activePatientId } = state;
    if (!activePatientId) return;
    try {
      const patient = await apiClient.get<PatientProfile>(`/patients/${activePatientId}`);
      setState((s) => ({ ...s, activePatient: patient }));
    } catch {
      /* keep stale */
    }
  }, [state]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, setActivePatient, refreshPatient }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
