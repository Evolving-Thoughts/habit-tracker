// Network-only PWA. No Cache Storage, IndexedDB, precaching or offline API queue.
// In particular, never retain authenticated responses across users or logout.
// A future Push feature must be implemented separately; this worker has no alarms.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(
      event.request,
      url.pathname === "/api" || url.pathname.startsWith("/api/")
        ? { cache: "no-store" }
        : undefined,
    ),
  );
});
