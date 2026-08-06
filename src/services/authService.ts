import { apiClient, setAccessToken, type ApiUser } from "./apiClient";

export const authService = {
  async login(email: string, password: string) {
    const payload = await apiClient.post<{ accessToken: string; user: ApiUser }>("/api/auth/login", { email, password });
    setAccessToken(payload.accessToken);
    return payload.user;
  },
  async restore() {
    const payload = await apiClient.restoreSession();
    return payload?.user ?? null;
  },
  async signOut() {
    try { await apiClient.post<void>("/api/auth/logout", {}); }
    finally { setAccessToken(null); }
  },
};
