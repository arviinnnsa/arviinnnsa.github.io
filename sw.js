/* Arvin's Planner service worker (v6)
   - Notifications: tapping one opens (or focuses) the planner.
   - Opening the app: tries the network for up to 2.5 s, then shows the saved copy,
     so a weak signal never leaves you on a blank screen.
   - Icons, splash screens: served instantly from the device, refreshed in the background.
   - Inter font: saved on the device so the app looks the same offline.
   - Google Calendar, sign-in and weather requests are never cached here
     (the app keeps its own saved copy of your events). */
const VERSION = "ap-v15";
const SHELL = VERSION + "-shell";
const FONTS = "ap-fonts-v2";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800&display=swap";
const SPLASH = ["640x1136","750x1334","828x1792","1125x2436","1170x2532","1179x2556","1206x2622",
  "1242x2688","1260x2736","1284x2778","1290x2796","1320x2868"].map(s => "splash-ag-" + s + ".png");
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "icon-maskable-512.png", "apple-touch-icon.png", "favicon-48.png", "favicon.ico", ...SPLASH];
const NAV_TIMEOUT = 2500;

async function warmFonts() {
  try {
    const c = await caches.open(FONTS);
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    await c.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  } catch (e) {}
}

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(Promise.all([
    caches.open(SHELL).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))),
    warmFonts()
  ]));
});

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function handleNavigate(event) {
  const c = await caches.open(SHELL);
  const network = fetch(event.request).then(res => {
    if (res.ok) c.put("./", res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));  // keep updating the saved copy even after a timeout
  try {
    return await Promise.race([network, timeout(NAV_TIMEOUT)]);
  } catch (e) {
    const saved = await c.match("./") || await c.match("index.html");
    if (saved) return saved;
    return network;  // nothing saved yet: keep waiting for the network
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const c = await caches.open(cacheName);
  const saved = await c.match(event.request, { ignoreSearch: false });
  const network = fetch(event.request).then(res => {
    if (res.ok || res.type === "opaque") c.put(event.request, res.clone());
    return res;
  });
  if (saved) { event.waitUntil(network.catch(() => {})); return saved; }
  return network;
}

async function cacheFirst(event, cacheName) {
  const c = await caches.open(cacheName);
  const saved = await c.match(event.request);
  if (saved) return saved;
  const res = await fetch(event.request);
  if (res.ok || res.type === "opaque") c.put(event.request, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/.netlify/")) return;
    if (r.mode === "navigate") { e.respondWith(handleNavigate(e)); return; }
    if (url.pathname.endsWith("/sw.js")) return;
    e.respondWith(staleWhileRevalidate(e, SHELL));
    return;
  }
  if (url.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(e, FONTS)); return; }
  if (url.hostname === "fonts.googleapis.com") { e.respondWith(staleWhileRevalidate(e, FONTS)); return; }
  // everything else (Google Calendar API, sign-in, weather) goes straight to the network
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
