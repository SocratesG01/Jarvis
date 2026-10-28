// Keeps the app itself available offline. Data is cached by the app (localStorage);
// photos are cached here after they've been seen once.
const VERSION = "jarvis-v6";
const SHELL = ["./", "index.html", "style.css", "app.js", "data.js", "config.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache API calls or auth.
  if (url.hostname.endsWith("supabase.co") && !url.pathname.includes("/storage/v1/object/sign/")) return;
  // Photos (signed URLs): cache by path so they show offline.
  if (url.pathname.includes("/storage/v1/object/sign/")) {
    const key = url.origin + url.pathname;
    e.respondWith(caches.open(VERSION + "-photos").then(async (c) => { const hit = await c.match(key); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(key, res.clone()); return res; }));
    return;
  }
  // App shell and fonts: network first (skipping the browser cache for our own files, so a new version shows at once), fall back to cache.
  e.respondWith(fetch(req, url.origin === location.origin ? { cache: "no-cache" } : {}).then((res) => { if (res.ok && (url.origin === location.origin || url.hostname.includes("jsdelivr") || url.hostname.includes("fonts."))) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
});
