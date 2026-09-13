// Minimal service worker. It doesn't cache aggressively (this app always
// wants fresh data from the server), it just needs to exist so iOS Safari
// is happy treating the home-screen shortcut as an installable web app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
self.addEventListener("fetch", () => {});
