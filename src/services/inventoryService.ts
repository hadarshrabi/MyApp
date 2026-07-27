import { bouquets } from "../data/mockData";

export const inventoryService = {
  async listBouquets() { return structuredClone(bouquets); },
  async addStock(stationId: number, amount: number) { return { stationId, amount, saved: true }; },
};
