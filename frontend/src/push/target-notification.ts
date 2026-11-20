/**
 * The system notification the open app shows when a stopwatch reaches its
 * Soll. It shares its tag with the server's Web Push (`public/sw.js`), so
 * whichever comes second replaces the first silently, and it tells the
 * service worker, which then leaves the push out. Never asks for
 * permission: that is a step in Einstellungen.
 */
export function targetNotificationTag(timerId: string): string {
  return `habit-timer-${timerId}`;
}

export async function showTargetNotification(
  timerId: string,
  body: string,
): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const tag = targetNotificationTag(timerId);
  try {
    const registration =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (!registration) {
      new Notification("Soll erreicht", { body, tag });
      return;
    }
    // The push may have been faster; then it already said so.
    const shown = await registration.getNotifications({ tag });
    if (!shown.length)
      await registration.showNotification("Soll erreicht", {
        body,
        tag,
        icon: "/icon-192.svg",
        data: { url: "/" },
      });
    registration.active?.postMessage({ type: "timer-notified", timerId });
  } catch {
    /* A refused or unsupported notification leaves the toast in the app. */
  }
}
