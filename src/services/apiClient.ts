export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export const apiClient: ApiClient = {
  async get<T>() { throw new Error("שירות השרת עדיין לא חובר"); },
  async post<T>() { throw new Error("שירות השרת עדיין לא חובר"); },
};
