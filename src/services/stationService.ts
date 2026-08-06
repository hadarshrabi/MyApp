import { apiClient } from "./apiClient";

export type StationInput = {
  name: string;
  address: string;
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  internalNotes: string | null;
  products?: Array<{ productId: string; initialQuantity: number }>;
};

export const stationService = {
  create(input: StationInput) {
    return apiClient.post("/api/admin/stations", input);
  },
  update(id: number, input: Partial<StationInput>, reason: string) {
    return apiClient.patch(`/api/admin/stations/${id}`, { ...input, reason });
  },
  setActive(id: number, active: boolean, reason: string) {
    return apiClient.post(`/api/admin/stations/${id}/status`, { active, reason });
  },
  archive(id: number) {
    return apiClient.post(`/api/admin/stations/${id}/archive`, {});
  },
  restore(id: number, active = false) {
    return apiClient.post(`/api/admin/stations/${id}/restore`, { active });
  },
  permanentlyDelete(id: number, confirmationName: string) {
    return apiClient.delete(`/api/admin/stations/${id}`, { confirmationName });
  },
  duplicate(id: number, name: string) {
    return apiClient.post(`/api/admin/stations/${id}/duplicate`, { name, copyInventory: true });
  },
  addProduct(stationId: number, productId: string, initialQuantity: number) {
    return apiClient.post(`/api/admin/stations/${stationId}/products`, { productId, initialQuantity, reason: "הוספת סוג זר לעמדה" });
  },
  removeProduct(stationId: number, productId: string, reason: string) {
    return apiClient.delete(`/api/admin/stations/${stationId}/products/${productId}`, { reason });
  },
  adjustInventory(stationId: number, productId: string, quantityDelta: number, transactionType: "STOCK_DELIVERY" | "DAMAGED_REMOVAL" | "MANUAL_ADJUSTMENT", reason: string) {
    return apiClient.patch(`/api/admin/stations/${stationId}/products/${productId}`, { quantityDelta, transactionType, reason });
  },
  updateProductDetails(stationId: number, productId: string, value: { name: string; price: number; quantity: number }) {
    return apiClient.patch(`/api/admin/stations/${stationId}/products/${productId}/details`, { ...value, reason: "עריכת סוג זר בעמדה" });
  },
};
