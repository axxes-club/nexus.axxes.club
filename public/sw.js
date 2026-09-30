/*
 * Nexus service worker.
 *
 * Scope is deliberately narrow: it caches *static assets only*. Documents, RSC
 * payloads and API responses carry a signed-in person's private content, so they
 * always go to the network. Serving any of them from a cache would show one
 * person another person's pages on a shared machine, which is the one failure
 * mode a PWA must never have.
 *
 * What it does buy: the app shell, JS chunks, CSS and fonts are fetched once and
 * then served from the local disk, so a repeat visit paints immediately with no
 * network wait at all — the desktop-app feel.
 */

const VERSION = "nexus-v1";
const SHELL = `${VERSION}-shell`;

/** Same-origin, immutable, content-hashed build output. Safe to keep forever. */
const isImmutableAsset = (url) =>
  url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");

/** Icons and the manifest: same-origin, not user-specific, cheap to revalidate. */
const isStaticPublicAsset = (url) =>
  url.origin === self.location.origin &&
  /^\/(icon|apple-icon|manifest\.webmanifest|.*\.(?:svg|png|webp|ico|woff2?))$/.test(url.pathname);

self.addEventListener("install", (event) => {
  // Take over immediately: a new worker waiting behind an open tab is a fix
  // nobody receives until they happen to close every window.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable. A POST to a server action mutates data; intercepting
  // one at all risks replaying it.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin is left entirely alone; the origin server sets those policies.
  if (url.origin !== self.location.origin) return;

  // Everything that is a document, an RSC payload or an API call goes straight
  // through. No cache lookup, no cache write, no offline fallback.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) return;
  if (request.headers.get("rsc") !== null) return;
  if (request.headers.get("next-router-prefetch") !== null) return;
  if (request.headers.get("next-router-state-tree") !== null) return;

  if (isImmutableAsset(url)) {
    // Content-hashed: the URL changes when the bytes do, so a hit is always right.
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isStaticPublicAsset(url)) {
    // Revalidate in the background: fast when fresh, self-healing when not.
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
  // Anything else falls through to the browser's default handling untouched.
});
