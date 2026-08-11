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

test("iOS install hint is compact, dismissible, and hidden in standalone mode", async ({ browser }) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
  ];
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    const hint = page.getByRole("status", { name: "התקנת האפליקציה באייפון" });
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("לחצו על שיתוף ב־Safari ואז על „הוספה למסך הבית”");
    const bounds = await hint.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 8);
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1
          ? [{ className: element.className, tag: element.tagName, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }]
          : [];
      }).slice(0, 10),
    }));
    expect(layout.scrollWidth, JSON.stringify(layout.offenders)).toBeLessThanOrEqual(viewport.width);
    const closeButton = page.getByRole("button", { name: "סגירת הוראות התקנה" });
    const closeSize = await closeButton.boundingBox();
    expect(closeSize!.width).toBeGreaterThanOrEqual(40);
    expect(closeSize!.height).toBeGreaterThanOrEqual(40);
    const inputSize = await page.getByPlaceholder("name@example.com").evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(inputSize).toBeGreaterThanOrEqual(16);

  }

  await page.setViewportSize({ width: 390, height: 390 });
  await page.goto("/login");
  await page.waitForTimeout(450);
  const emailInput = page.getByPlaceholder("name@example.com");
  await emailInput.focus();
  await expect(emailInput).toBeFocused();
  await expect(page.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toBeHidden();
  await emailInput.blur();
  await expect(page.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toBeVisible();

  await page.setViewportSize({ width: 667, height: 320 });
  await page.goto("/login");
  await expect(page.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(667);

  await page.getByRole("button", { name: "סגירת הוראות התקנה" }).click();
  await expect(page.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toHaveCount(0);
  await context.close();

  const standaloneContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    serviceWorkers: "block",
  });
  const standalonePage = await standaloneContext.newPage();
  await standalonePage.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  });
  await standalonePage.goto("/login");
  await expect(standalonePage.getByRole("status", { name: "התקנת האפליקציה באייפון" })).toHaveCount(0);
  await standaloneContext.close();
});
