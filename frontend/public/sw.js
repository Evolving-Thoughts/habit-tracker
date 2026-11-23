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

// Timers the open app has already announced itself (src/push/target-notification.ts).
// Kept in memory only; when the worker was stopped meanwhile, the shared tag still merges both.
const announcedTimers = new Set();
self.addEventListener("message", (event) => {
  if (event.data?.type === "activate-push-worker")
    event.waitUntil(self.skipWaiting());
  if (event.data?.type === "timer-notified" && pushId(event.data.timerId))
    announcedTimers.add(event.data.timerId);
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
// What each kind of push shows. Fixed texts: a payload never carries content;
// the only words of the user's own (a Daily's title) come with the receipt,
// fetched behind the session.
const MESSAGES = {
  "timer-target-reached": (data) => ({
    tag: `habit-timer-${data.timerId}`,
    title: "Du hast dein Soll erreicht",
    body: "Die Stoppuhr läuft weiter.",
    url: "/",
  }),
  // The evening reminder of "Das Beste des Tages" (one per day).
  "day-best-reminder": () => ({
    tag: "habit-day-best",
    title: "Was war heute das Beste?",
    body: "Eine Zeile reicht.",
    url: "/#/heute",
  }),
  // The daily reminder of the Monats-Challenge (one per day).
  "challenge-reminder": (_data, receipt) => {
    const title =
      typeof receipt?.title === "string" ? receipt.title.trim().slice(0, 200) : "";
    return {
      tag: "habit-month-challenge",
      title: "Monats-Challenge",
      body: title
        ? `${title} ist heute noch offen.`
        : "Der Lauf von heute ist noch offen.",
      url: "/#/heute",
    };
  },
};
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const data = event.data?.json();
        if (
          !Object.hasOwn(MESSAGES, data?.type) ||
          (data.type === "timer-target-reached" && !pushId(data.timerId)) ||
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
        // Fail closed: verify this exact device/session and that it still holds
        // (timer still at its Soll, the day still without its line) before display.
        // Logout/reset/stop/opt-out after send must not reveal a late notification.
        const response = await fetch(
          `/api/push/deliveries/${data.deliveryId}`,
          { credentials: "include", cache: "no-store" },
        );
        const receipt = response.ok ? await response.json() : null;
        if (!receipt?.allowed || expires <= Date.now()) return;
        const message = MESSAGES[data.type](data, receipt);
        const latest = await pushPreference();
        if (!latest.enabled || latest.subscriptionId !== data.subscriptionId)
          return;
        // The open app said it already: no second notification for the same Soll.
        const { tag } = message;
        if (data.type === "timer-target-reached" && announcedTimers.has(data.timerId))
          return;
        if ((await self.registration.getNotifications({ tag })).length) return;
        await self.registration.showNotification(message.title, {
          body: message.body,
          icon: "/icon-192.svg",
          tag,
          renotify: false,
          data: { url: message.url },
        });
      } catch {
        /* Missing permission, offline server or invalid message: show nothing. */
      }
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only the fixed paths above; anything else opens the start page.
  const path = ["/", "/#/heute"].includes(event.notification.data?.url)
    ? event.notification.data.url
    : "/";
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
      await self.clients.openWindow(new URL(path, self.location.origin).href);
    })(),
  );
});
