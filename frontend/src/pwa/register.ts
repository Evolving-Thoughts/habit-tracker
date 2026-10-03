// Keep Vite development/HMR unaffected. Failure must not block using the app.
export async function registerServiceWorker(): Promise<void> {
  if (
    !import.meta.env.PROD ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return;
  try {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    console.warn(
      "PWA konnte nicht aktiviert werden. Die App bleibt im Browser nutzbar.",
    );
  }
}
