import { stations } from "../data/mockData";
import type { Station } from "../types/models";

export const stationService = {
  async list(): Promise<Station[]> { return structuredClone(stations); },
  async get(id: number): Promise<Station | undefined> { return stations.find(item => item.id === id); },
};
