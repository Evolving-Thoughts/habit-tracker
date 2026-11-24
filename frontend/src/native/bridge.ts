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

/** This page runs inside the Android app (with or without a given plugin). */
export function isNativeAndroid(): boolean {
  const candidate = (globalThis as { Capacitor?: Bridge }).Capacitor;
  return candidate?.getPlatform?.() === "android";
}

/** The bridge on Android when the app carries `plugin`; otherwise null. */
export function nativeBridge(plugin: string): Bridge | null {
  const candidate = (globalThis as { Capacitor?: Bridge }).Capacitor;
  if (!candidate || !isNativeAndroid()) return null;
  if (!candidate.PluginHeaders?.some((header) => header.name === plugin))
    return null;
  return candidate;
}

/**
 * Listens to a plugin event and hands over what it carries (the JSObject the
 * plugin passed to notifyListeners); the returned function stops listening.
 * Does nothing on a bridge without callbacks.
 */
export function listenNativeData<T = unknown>(
  cap: Bridge,
  plugin: string,
  eventName: string,
  handler: (data: T) => void,
): () => void {
  if (!cap.nativeCallback || !cap.nativePromise) return () => {};
  const callbackId = cap.nativeCallback(
    plugin,
    "addListener",
    { eventName },
    (data) => handler(data as T),
  );
  return () =>
    void cap.nativePromise!(plugin, "removeListener", {
      eventName,
      callbackId,
    }).catch(() => {});
}

/** Like `listenNativeData`, for events whose data does not matter. */
export function listenNative(
  cap: Bridge,
  plugin: string,
  eventName: string,
  handler: () => void,
): () => void {
  return listenNativeData(cap, plugin, eventName, () => handler());
}
