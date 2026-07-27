import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.linoydesigns.management",
  appName: "לינוי עיצובים",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Geolocation: {
      enableHighAccuracy: true,
    },
  },
};

export default config;
