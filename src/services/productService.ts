import { apiClient } from "./apiClient";

export const productService = {
  create(name: string, price: number) {
    return apiClient.post("/api/admin/products", { name, price, active: true });
  },
  update(id: string, value: { name?: string; price?: number; active?: boolean }, reason: string) {
    return apiClient.patch(`/api/admin/products/${id}`, { ...value, reason });
  },
};
