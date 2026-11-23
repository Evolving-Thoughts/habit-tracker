import type { FocusBlockState } from "../types/focus-block";

/**
 * The Android plugin `FocusBlock` (frontend/android, docs/focus-block.md),
 * reached through the bridge Capacitor injects into the app's page. The web
 * build bundles no Capacitor code: in a browser there is no bridge and
 * `focusBlockNative()` is null, so every caller keeps working without it.
 */

export type FocusBlockNativeStatus = {
  /** The accessibility service "Fokus-Sperre" is switched on. */
  accessibilityEnabled: boolean;
  /** Android's VPN consent was given to this app. */
  vpnPrepared: boolean;
};

export type InstalledApp = { label: string; packageName: string };

export type FocusBlockNative = {
  getStatus(): Promise<FocusBlockNativeStatus>;
  openAccessibilitySettings(): Promise<void>;
  requestVpnPermission(): Promise<{ granted: boolean }>;
  listInstalledApps(): Promise<InstalledApp[]>;
  /**
   * Hands the state to the phone, which stores it and enforces it on its
   * own from then on (also when this page is gone) and polls `pollUrl`
   * with the session cookie. Null forgets it (signed out).
   */
  setBlock(state: FocusBlockState | null): Promise<void>;
  /** "Zurück zur Quest" on the block screen: open the Fokus-Modus. */
  onOpenFocus(handler: () => void): () => void;
};

type Bridge = {
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

const PLUGIN = "FocusBlock";

function bridge(): Bridge | null {
  const candidate = (globalThis as { Capacitor?: Bridge }).Capacitor;
  if (!candidate || candidate.getPlatform?.() !== "android") return null;
  if (!candidate.PluginHeaders?.some((header) => header.name === PLUGIN))
    return null;
  return candidate;
}

/** The API's absolute address, which the phone polls by itself. */
function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
  return new URL(`${base}${path}`, window.location.href).toString();
}

/** The plugin on Android; null in a browser or an app without it. */
export function focusBlockNative(): FocusBlockNative | null {
  const cap = bridge();
  if (!cap?.nativePromise) return null;
  const call = <T>(method: string, options: object = {}) =>
    cap.nativePromise!(PLUGIN, method, options) as Promise<T>;
  return {
    getStatus: () => call<FocusBlockNativeStatus>("getStatus"),
    openAccessibilitySettings: () => call<void>("openAccessibilitySettings"),
    requestVpnPermission: () =>
      call<{ granted: boolean }>("requestVpnPermission"),
    listInstalledApps: async () =>
      (await call<{ apps: InstalledApp[] }>("listInstalledApps")).apps,
    setBlock: (state) =>
      call<void>(
        "setBlock",
        state
          ? {
              state,
              pollUrl: apiUrl("/focus-block"),
              endUrl: apiUrl("/focus-block/end"),
              origin: window.location.origin,
            }
          : { state: null },
      ),
    onOpenFocus: (handler) => {
      if (!cap.nativeCallback) return () => {};
      const callbackId = cap.nativeCallback(
        PLUGIN,
        "addListener",
        { eventName: "openFocus" },
        () => handler(),
      );
      return () =>
        void call("removeListener", {
          eventName: "openFocus",
          callbackId,
        }).catch(() => {});
    },
  };
}
