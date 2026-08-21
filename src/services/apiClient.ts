let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).then(async response => {
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const payload = await response.json();
      accessToken = payload.accessToken;
      return true;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && await refreshAccessToken()) return request<T>(path, init, false);
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "הבקשה לא הושלמה");
  return payload;
}

export const apiClient = {
  get<T>(path: string) { return request<T>(path); },
  post<T>(path: string, body: unknown) { return request<T>(path, { method: "POST", body: JSON.stringify(body) }); },
  patch<T>(path: string, body: unknown) { return request<T>(path, { method: "PATCH", body: JSON.stringify(body) }); },
  delete<T>(path: string, body: unknown) { return request<T>(path, { method: "DELETE", body: JSON.stringify(body) }); },
  async restoreSession() {
    if (!(await refreshAccessToken())) return null;
    return request<{ user: ApiUser }>("/api/me", {}, false);
  },
  async getStreamToken() {
    const payload = await request<{ token: string }>("/api/stream/token", { method: "POST", body: "{}" });
    return payload.token;
  },
};

export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  systemRole: "ADMIN" | "EMPLOYEE";
  employee: { id: string; jobPosition: string; assignedStationId: number | null } | null;
};
