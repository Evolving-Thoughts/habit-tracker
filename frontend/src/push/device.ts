import { request } from "../api/http";
import { bindIfEnabled, readPreference, writePreference } from "./preferences";
export interface PushConfig {
  configured: boolean;
  publicKey: string | null;
}
export const pushConfig = () => request<PushConfig>("/push/config");
export function supported(): boolean {
  return (
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "indexedDB" in window
  );
}
async function registration(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Öffne die gebaute PWA über HTTPS und versuche es erneut.",
              ),
            ),
          5000,
        );
      }),
    ]);
    await reg.update();
    // Explicit activation of the new push-capable, still network-only worker.
    if (reg.waiting) {
      const changed = new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
      reg.waiting.postMessage({ type: "activate-push-worker" });
      await Promise.race([
        changed,
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    return reg;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
export async function enablePush(
  config: PushConfig,
  askPermission: boolean,
): Promise<void> {
  if (!supported() || !config.publicKey)
    throw new Error("Push ist hier noch nicht verfügbar.");
  // Called directly by the activation button. Silent login rebinding NEVER opens a prompt.
  const permission =
    Notification.permission === "default" && askPermission
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted")
    throw new Error("Benachrichtigungen sind im Browser nicht erlaubt.");
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  const key = Uint8Array.from(
    atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (character) => character.charCodeAt(0),
  );
  if (
    subscription?.options.applicationServerKey &&
    Array.from(
      new Uint8Array(subscription.options.applicationServerKey),
    ).join() !== Array.from(key).join()
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key.buffer,
  });
  const json = subscription.toJSON();
  const saved = await request<{ id: string }>("/push/subscription", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (askPermission) {
    await writePreference({ enabled: true, subscriptionId: saved.id });
  } else if (!(await bindIfEnabled(saved.id))) {
    await request("/push/subscription", {
      method: "DELETE",
      body: JSON.stringify({ id: saved.id }),
    });
  }
}
export async function disablePush(): Promise<void> {
  const pref = await readPreference();
  // First persist opt-out: the worker suppresses even queued messages, including offline.
  await writePreference({ ...pref, enabled: false });
  if (pref.subscriptionId) {
    await request("/push/subscription", {
      method: "DELETE",
      body: JSON.stringify({ id: pref.subscriptionId }),
    });
    await writePreference({ enabled: false, subscriptionId: null });
  }
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const subscription = await reg?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }
}
export async function restorePush(config: PushConfig): Promise<void> {
  const pref = await readPreference();
  if (!pref.enabled) {
    if (pref.subscriptionId) await disablePush();
    return;
  }
  if (!supported() || Notification.permission !== "granted") {
    await disablePush();
    return;
  }
  if (config.configured) await enablePush(config, false);
}
