import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { apiClient } from "./apiClient";

export type Coordinates = { latitude: number; longitude: number; accuracy?: number };
export type GeocodeResult = { latitude: number; longitude: number; label: string };

export const locationService = {
  async searchPlaces(query: string): Promise<GeocodeResult[]> {
    return (await apiClient.get<{ results: GeocodeResult[] }>(`/api/geocode?q=${encodeURIComponent(query.trim())}`)).results;
  },
  async getCurrentPosition(): Promise<Coordinates> {
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.requestPermissions();
      if (permission.location === "denied") throw new Error("יש לאשר גישה למיקום במכשיר");
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("שירותי המיקום אינם נתמכים בדפדפן זה"));
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
        () => reject(new Error("לא ניתן לקבל את המיקום. יש לאשר גישה למיקום בדפדפן")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  },
};
