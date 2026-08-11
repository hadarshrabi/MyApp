import { expect, test } from "@playwright/test";

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), { timeout: 15_000 }).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true);
}

test("manifest, icons, and iOS metadata are installable", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()["content-type"]).toMatch(/application\/(manifest\+json|json)/);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Linoy Designs",
    short_name: "Linoy",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#456b58",
    background_color: "#f7f6f2",
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" }),
    expect.objectContaining({ src: "/icons/icon-maskable-192.png", sizes: "192x192", purpose: "maskable" }),
    expect.objectContaining({ src: "/icons/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
  ]));

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");

  const expectedIcons = [
    ["/icons/icon-192.png", 192],
    ["/icons/icon-512.png", 512],
    ["/icons/icon-maskable-192.png", 192],
    ["/icons/icon-maskable-512.png", 512],
    ["/icons/apple-touch-icon.png", 180],
  ] as const;
  for (const [src, size] of expectedIcons) {
    const dimensions = await page.evaluate(async ({ src, size }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, size };
    }, { src, size });
    expect(dimensions).toEqual({ width: size, height: size, size });
  }
});

test("service worker never caches API and provides conservative offline UX", async ({ page, context }) => {
  await page.goto("/login");
  await waitForServiceWorker(page);

  await page.evaluate(async () => {
    await fetch("/api/health/live");
    await fetch("/api/health/ready", { headers: { authorization: "Bearer cache-safety-probe" } });
  });
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      urls.push(...(await cache.keys()).map(request => request.url));
    }
    return urls;
  });
  expect(cachedUrls.some(url => new URL(url).pathname.startsWith("/api/"))).toBe(false);

  await context.setOffline(true);
  await expect(page.getByText("אין חיבור לאינטרנט. נתונים ופעולות לא יישמרו עד לחזרת החיבור.")).toBeVisible();
  await page.goto("/offline-verification", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "אין כרגע חיבור לאינטרנט" })).toBeVisible();
  await context.setOffline(false);
});

test("updates require an explicit user action", async ({ page, request }) => {
  await page.goto("/login");
  await waitForServiceWorker(page);
  const registration = await page.evaluate(async () => {
    const value = await navigator.serviceWorker.getRegistration();
    return { active: Boolean(value?.active), waiting: Boolean(value?.waiting) };
  });
  expect(registration.active).toBe(true);
  expect(registration.waiting).toBe(false);

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(await worker.text()).toContain("SKIP_WAITING");
  await expect(page.getByRole("button", { name: "עדכון עכשיו" })).toHaveCount(0);
});
