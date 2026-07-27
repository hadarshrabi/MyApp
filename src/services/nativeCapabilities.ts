export interface NativeCapabilities {
  takePhoto(): Promise<string>;
  scheduleNotification(title: string, body: string): Promise<void>;
  share(title: string, text: string): Promise<void>;
  saveSecurely(key: string, value: string): Promise<void>;
  authenticateBiometrically(): Promise<boolean>;
}

export const nativeCapabilities: NativeCapabilities = {
  async takePhoto() { throw new Error("המצלמה תחובר בשלב האפליקציה המקומית"); },
  async scheduleNotification() { throw new Error("ההתראות המקומיות יחוברו בשלב האפליקציה המקומית"); },
  async share() { throw new Error("השיתוף המקומי יחובר בשלב האפליקציה המקומית"); },
  async saveSecurely() { throw new Error("האחסון המאובטח יחובר בשלב האפליקציה המקומית"); },
  async authenticateBiometrically() { throw new Error("הזיהוי הביומטרי יחובר בשלב האפליקציה המקומית"); },
};
