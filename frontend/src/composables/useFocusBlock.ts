import { computed, inject, ref, type InjectionKey } from "vue";
import {
  addFocusEntry,
  endFocusBlock,
  getFocusBlock,
  removeFocusEntry,
  saveFocusSettings,
  startFocusBlock,
} from "../api/focus-block.api";
import {
  focusBlockNative,
  type FocusBlockNative,
  type FocusBlockNativeStatus,
} from "../native/focus-block-plugin";
import type {
  AddFocusEntryInput,
  FocusBlockMode,
  FocusBlockState,
  FocusSettings,
} from "../types/focus-block";
import { focusSetupIssues, remainingMinutes } from "../utils/focus-block";

/**
 * The Fokus-Sperre of the signed-in user for everything below
 * `TimerProvider`: settings, lists and the open block, read from the server
 * and changed there. Whether a block starts is the server's decision on
 * every stopwatch start, resume, pause and stop; this only reads it. On
 * Android every answer also goes to the plugin, which stores it and
 * enforces the block on its own, also once this page is gone, and the
 * phone's two permissions are read with each refresh (`setupIssues`).
 */
export function createFocusBlockController(
  native: FocusBlockNative | null = focusBlockNative(),
) {
  const state = ref<FocusBlockState | null>(null);
  /** The phone's permissions; null in a browser or before the first read. */
  const device = ref<FocusBlockNativeStatus | null>(null);
  const error = ref("");
  const busy = ref(false);
  /** Device clock minus server clock, from the last answer. */
  let skew = 0;
  /** Ticks while a Hardcore block counts down. */
  const now = ref(Date.now());
  let alive = true;
  let revision = 0;

  function apply(next: FocusBlockState): void {
    skew = Date.now() - Date.parse(next.serverNow);
    now.value = Date.now();
    state.value = next;
    error.value = "";
    void native?.setBlock(next).catch(() => {});
  }

  async function readDevice(): Promise<void> {
    if (!native) return;
    try {
      const next = await native.getStatus();
      if (alive && next) device.value = next;
    } catch {
      // The stand stays as last read.
    }
  }

  async function refresh(): Promise<void> {
    if (!alive || busy.value) return;
    void readDevice();
    const version = revision;
    try {
      const next = await getFocusBlock();
      if (alive && version === revision) apply(next);
    } catch (cause) {
      if (alive && version === revision)
        error.value =
          cause instanceof Error
            ? cause.message
            : "Die Fokus-Sperre konnte nicht geladen werden.";
    }
  }

  /** A change on the server; its answer is the new state. False on failure. */
  async function change(
    operation: () => Promise<FocusBlockState>,
  ): Promise<boolean> {
    if (!alive || busy.value) return false;
    busy.value = true;
    ++revision;
    try {
      const next = await operation();
      if (alive) apply(next);
      return true;
    } catch (cause) {
      if (alive)
        error.value =
          cause instanceof Error
            ? cause.message
            : "Die Fokus-Sperre konnte nicht geändert werden.";
      return false;
    } finally {
      busy.value = false;
    }
  }

  const block = computed(() => state.value?.block ?? null);
  /** What keeps a block from stopping anything (`focusSetupIssues`). */
  const setupIssues = computed(() =>
    focusSetupIssues(state.value, device.value),
  );
  /** Minutes left of a Hardcore block, on the server's clock; else null. */
  const minutesLeft = computed(() => {
    const endsAt = block.value?.endsAt;
    return endsAt ? remainingMinutes(endsAt, now.value - skew) : null;
  });

  return {
    state,
    block,
    device,
    setupIssues,
    error,
    busy,
    minutesLeft,
    native,
    readDevice,
    /** Android's accessibility settings; the stand is read on return. */
    openAccessibilitySettings: async () => {
      await native?.openAccessibilitySettings().catch(() => {});
    },
    /** Android's VPN consent dialog, then the stand again. */
    allowVpn: async () => {
      try {
        await native?.requestVpnPermission();
      } catch {
        // Declined or failed: the stand says so.
      }
      await readDevice();
    },
    /** The server's "now" as the device sees it, for countdowns. */
    serverNow: () => now.value - skew,
    refresh,
    saveSettings: (change_: Partial<FocusSettings>) =>
      change(() => saveFocusSettings(change_)),
    addEntry: (entry: AddFocusEntryInput) =>
      change(() => addFocusEntry(entry)),
    removeEntry: (id: number) => change(() => removeFocusEntry(id)),
    start: (mode: FocusBlockMode) => change(() => startFocusBlock({ mode })),
    end: () => change(endFocusBlock),
    /** Moves the countdown on; a block past its moment is read again. */
    tick: () => {
      now.value = Date.now();
      if (minutesLeft.value === 0) void refresh();
    },
    dispose: () => {
      alive = false;
      ++revision;
      // Signed out: the phone forgets the block and the session.
      void native?.setBlock(null).catch(() => {});
    },
  };
}
export type FocusBlockController = ReturnType<
  typeof createFocusBlockController
>;

export const focusBlockKey: InjectionKey<FocusBlockController> =
  Symbol("focus-block");
export function useFocusBlock(): FocusBlockController | null {
  return inject(focusBlockKey, null);
}
