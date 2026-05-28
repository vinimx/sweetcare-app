import { tokenStorage } from "../storage/secure-storage.js";

const API_BASE = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RefreshListener = () => Promise<string | null>;
let refreshListener: RefreshListener | null = null;

export function setRefreshListener(fn: RefreshListener) {
  refreshListener = fn;
}

async function buildHeaders(includeAuth = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Version": "1",
  };
  if (includeAuth) {
    const token = await tokenStorage.getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return new ApiError(res.status, body.error ?? "UNKNOWN", body.message ?? res.statusText);
  } catch {
    return new ApiError(res.status, "PARSE_ERROR", res.statusText);
  }
}

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string | null) => void }> = [];

async function handleRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      pendingQueue.push({ resolve });
    });
  }
  isRefreshing = true;
  try {
    const newToken = refreshListener ? await refreshListener() : null;
    pendingQueue.forEach((p) => {
      p.resolve(newToken);
    });
    pendingQueue = [];
    return newToken;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = await buildHeaders(auth);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });

  if (res.status === 401 && auth && refreshListener) {
    const newToken = await handleRefresh();
    if (newToken) {
      const retryHeaders = await buildHeaders(true);
      const retry = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
      if (!retry.ok) throw await parseError(retry);
      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string, auth = true): Promise<T> {
    return request<T>(path, { method: "GET" }, auth);
  },
  post<T>(path: string, body: unknown, auth = true): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) }, auth);
  },
  patch<T>(path: string, body: unknown, auth = true): Promise<T> {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, auth);
  },
  delete<T = void>(path: string, body?: unknown, auth = true): Promise<T> {
    return request<T>(
      path,
      { method: "DELETE", body: body ? JSON.stringify(body) : undefined },
      auth,
    );
  },
};
