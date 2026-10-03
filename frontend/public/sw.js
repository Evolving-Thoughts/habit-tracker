// Network-only app/API. No Cache Storage, precaching or offline API queue.
// IndexedDB stores only a device opt-in flag and opaque subscription ID.
// In particular, never retain authenticated responses across users or logout.
// Push comes from the server; this worker never runs a local countdown/alarm.
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "activate-push-worker")
    event.waitUntil(self.skipWaiting());
});
// Same metadata store as src/push/preferences.ts. No private app content or session tokens.
async function pushPreference() {
  return new Promise((resolve) => {
    const request = indexedDB.open("habit-push-preferences", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("settings");
    request.onerror = () => resolve({ enabled: false });
    request.onsuccess = () => {
      const db = request.result;
      const read = db
        .transaction("settings")
        .objectStore("settings")
        .get("push");
      read.onsuccess = () => {
        db.close();
        resolve(read.result ?? { enabled: false });
      };
      read.onerror = () => {
        db.close();
        resolve({ enabled: false });
      };
    };
  });
}
const pushId = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const data = event.data?.json();
        if (
          data?.type !== "timer-finished" ||
          !pushId(data.timerId) ||
          !pushId(data.deliveryId) ||
          !pushId(data.subscriptionId)
        )
          return;
        const expires = Date.parse(data.expiresAt);
        if (!Number.isFinite(expires) || expires <= Date.now()) return;
        const pref = await pushPreference();
        if (
          !pref.enabled ||
          pref.subscriptionId !== data.subscriptionId ||
          Notification.permission !== "granted"
        )
          return;
        // Fail closed: verify this exact device/session and still-valid timer before display.
        // Logout/reset/stop/opt-out after send must not reveal a late notification.
        const response = await fetch(
          `/api/push/deliveries/${data.deliveryId}`,
          { credentials: "include", cache: "no-store" },
        );
        if (
          !response.ok ||
          !(await response.json()).allowed ||
          expires <= Date.now()
        )
          return;
        const latest = await pushPreference();
        if (!latest.enabled || latest.subscriptionId !== data.subscriptionId)
          return;
        await self.registration.showNotification("Dein Timer ist abgelaufen", {
          body: "Öffne die App, um fortzufahren.",
          icon: "/icon-192.svg",
          tag: `habit-timer-${data.timerId}`,
          renotify: false,
          data: { url: "/" },
        });
      } catch {
        /* Missing permission, offline server or invalid message: show nothing. */
      }
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(new URL("/", self.location.origin).href);
    })(),
  );
});
