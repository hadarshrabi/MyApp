/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

const CACHE_PREFIX = "linoy-pwa";

const safeCachePlugin = {
  async cacheWillUpdate({ request, response }: { request: Request; response: Response }) {
    if (request.method !== "GET" || request.headers.has("authorization")) return null;
    if (new URL(request.url).pathname.startsWith("/api/")) return null;
    if (!response.ok || response.headers.has("set-cookie")) return null;
    return response;
  },
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

registerRoute(
  ({ request, url }) => request.method === "GET"
    && request.mode === "navigate"
    && url.origin === self.location.origin
    && !url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-navigation-v1`,
    networkTimeoutSeconds: 5,
    plugins: [safeCachePlugin, new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 24 * 60 * 60 })],
  }),
);

registerRoute(
  ({ request, url }) => request.method === "GET"
    && url.origin === self.location.origin
    && !url.pathname.startsWith("/api/")
    && !request.headers.has("authorization")
    && ["script", "style", "font", "image"].includes(request.destination),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-static-v1`,
    plugins: [safeCachePlugin, new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") return (await matchPrecache("/offline.html")) ?? Response.error();
  return Response.error();
});
