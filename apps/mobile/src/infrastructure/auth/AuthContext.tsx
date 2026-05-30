import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { tokenStorage } from "../storage/secure-storage.js";
import { apiClient, setRefreshListener } from "../api/client.js";
import type { User, PatientProfile, AuthTokens } from "@sweetcare/shared-types";

const ACTIVE_PATIENT_KEY = "sc_active_patient_id";

interface AuthLoginResponse extends AuthTokens {
  refreshToken: string;
  userId: string;
  role: string;
  user: User;
}

interface AuthRefreshResponse extends AuthTokens {
  refreshToken: string;
}

interface PatientsResponse {
  patients: PatientProfile[];
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  patients: PatientProfile[];
  activePatient: PatientProfile | null;
  activePatientId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; display_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  setActivePatient: (patient: PatientProfile) => Promise<void>;
  refreshPatient: () => Promise<void>;
  refreshPatients: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadPatients(): Promise<PatientProfile[]> {
  try {
    const resp = await apiClient.get<PatientsResponse>("/patients");
    return resp.patients;
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    patients: [],
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
      const patients = await loadPatients();
      const storedId = await SecureStore.getItemAsync(ACTIVE_PATIENT_KEY);

      let activePatient: PatientProfile | null = null;
      let activePatientId: string | null = storedId;

      if (storedId) {
        activePatient = patients.find((p) => p.id === storedId) ?? null;
      }
      // Auto-select first patient if none stored
      if (!activePatient && patients.length > 0) {
        activePatient = patients[0] ?? null;
        if (activePatient) {
          await SecureStore.setItemAsync(ACTIVE_PATIENT_KEY, activePatient.id);
          activePatientId = activePatient.id;
        }
      }

      setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        patients,
        activePatient,
        activePatientId,
      });
    } catch {
      await tokenStorage.clearAll();
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        patients: [],
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
        const data = await apiClient.post<AuthRefreshResponse>(
          "/auth/refresh",
          { refreshToken },
          false,
        );
        await tokenStorage.saveAccessToken(data.accessToken);
        await tokenStorage.saveRefreshToken(data.refreshToken);
        return data.accessToken;
      } catch {
        await tokenStorage.clearAll();
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          patients: [],
          activePatient: null,
          activePatientId: null,
        });
        return null;
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiClient.post<AuthLoginResponse>("/auth/login", { email, password }, false);
    await tokenStorage.saveAccessToken(data.accessToken);
    await tokenStorage.saveRefreshToken(data.refreshToken);
    const patients = await loadPatients();
    const storedId = await SecureStore.getItemAsync(ACTIVE_PATIENT_KEY);
    let activePatient: PatientProfile | null = null;
    let activePatientId: string | null = storedId;
    if (storedId) {
      activePatient = patients.find((p) => p.id === storedId) ?? null;
    }
    if (!activePatient && patients.length > 0) {
      activePatient = patients[0] ?? null;
      if (activePatient) {
        await SecureStore.setItemAsync(ACTIVE_PATIENT_KEY, activePatient.id);
        activePatientId = activePatient.id;
      }
    }
    setState((s) => ({
      ...s,
      isAuthenticated: true,
      user: data.user,
      patients,
      activePatient,
      activePatientId,
    }));
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; display_name: string }) => {
      const data = await apiClient.post<AuthLoginResponse>(
        "/auth/register",
        { ...input, role: "guardian" },
        false,
      );
      await tokenStorage.saveAccessToken(data.accessToken);
      await tokenStorage.saveRefreshToken(data.refreshToken);
      setState((s) => ({ ...s, isAuthenticated: true, user: data.user, patients: [] }));
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      await apiClient.post("/auth/logout", refreshToken ? { refreshToken } : {});
    } catch {
      /* best effort */
    }
    await tokenStorage.clearAll();
    await SecureStore.deleteItemAsync(ACTIVE_PATIENT_KEY);
    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      patients: [],
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

  const refreshPatients = useCallback(async () => {
    try {
      const patients = await loadPatients();
      setState((s) => {
        const updatedActive = s.activePatientId
          ? (patients.find((p) => p.id === s.activePatientId) ?? s.activePatient)
          : s.activePatient;
        return { ...s, patients, activePatient: updatedActive };
      });
    } catch {
      /* keep stale */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await apiClient.get<User>("/users/me");
      setState((s) => ({ ...s, user }));
    } catch {
      /* keep stale */
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        setActivePatient,
        refreshPatient,
        refreshPatients,
        refreshUser,
      }}
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
