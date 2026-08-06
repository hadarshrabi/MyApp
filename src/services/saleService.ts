import { apiClient } from "./apiClient";

export const saleService = {
  async create(productId: string, quantity: number) {
    return (await apiClient.post<{ sale: unknown }>("/api/sales", { productId, quantity })).sale;
  },
};
