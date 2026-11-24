/**
 * The bridge Capacitor injects into the Android app's page. The web build
 * bundles no Capacitor code: in a browser there is no bridge, `nativeBridge`
 * is null, and every caller keeps working without it.
 */
export type Bridge = {
  getPlatform?: () => string;
  PluginHeaders?: { name: string }[];
  nativePromise?: (
    plugin: string,
    method: string,
    options?: object,
  ) => Promise<unknown>;
  nativeCallback?: (
    plugin: string,
    method: string,
    options: object,
    callback: (data: unknown, error?: unknown) => void,
  ) => string;
};

/** The bridge on Android when the app carries `plugin`; otherwise null. */
export function nativeBridge(plugin: string): Bridge | null {
  const candidate = (globalThis as { Capacitor?: Bridge }).Capacitor;
  if (!candidate || candidate.getPlatform?.() !== "android") return null;
  if (!candidate.PluginHeaders?.some((header) => header.name === plugin))
    return null;
  return candidate;
}

/**
 * Listens to a plugin event; the returned function stops listening. Does
 * nothing on a bridge without callbacks.
 */
export function listenNative(
  cap: Bridge,
  plugin: string,
  eventName: string,
  handler: () => void,
): () => void {
  if (!cap.nativeCallback || !cap.nativePromise) return () => {};
  const callbackId = cap.nativeCallback(
    plugin,
    "addListener",
    { eventName },
    () => handler(),
  );
  return () =>
    void cap.nativePromise!(plugin, "removeListener", {
      eventName,
      callbackId,
    }).catch(() => {});
}
