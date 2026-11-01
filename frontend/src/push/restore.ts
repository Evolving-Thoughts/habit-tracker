import { onMounted, onUnmounted } from "vue";
import { pushConfig, restorePush, supported } from "./device";

/** Rebinds this device after login, also while the settings stay closed. */
export function useDevicePushRestore(): void {
  async function restore(): Promise<void> {
    if (document.hidden || !supported()) return;
    try {
      await restorePush(await pushConfig());
    } catch {
      // The settings run the same step and show its error.
    }
  }
  onMounted(() => {
    void restore();
    document.addEventListener("visibilitychange", restore);
  });
  onUnmounted(() => document.removeEventListener("visibilitychange", restore));
}
