import { onUnmounted } from "vue";
import type { Router } from "vue-router";
import { backButtonNative } from "../native/back-button-plugin";
import { closeTopOverlay, hasOpenOverlay } from "./useOverlayStack";

/**
 * What Back on the phone does, in this order:
 * - overlay: something is open on top; it closes, as its close button would.
 * - history: the person came here from another view; one step back.
 * - today: a view opened first (from a link, after a start); go to Heute.
 * - leave: Heute with nothing open; the app goes as Android's Back does.
 */
export type BackStep = "overlay" | "history" | "today" | "leave";

export function backStep(router: Router): BackStep {
  if (hasOpenOverlay()) return "overlay";
  // Vue Router keeps the previous entry of its own history here; a replace
  // keeps it as it was.
  if (router.options.history.state.back) return "history";
  if (router.currentRoute.value.name !== "today") return "today";
  return "leave";
}

/** Does `step`; false for "leave", which belongs to Android. */
export function runBackStep(router: Router, step: BackStep): boolean {
  if (step === "overlay") closeTopOverlay();
  else if (step === "history") router.back();
  else if (step === "today") void router.replace({ name: "today" });
  return step !== "leave";
}

/**
 * Takes Android's Back in the app (frontend/android BackButtonPlugin). The
 * answer goes out first, so a question an overlay asks on closing cannot
 * keep Android waiting. Nothing happens in a browser.
 */
export function useBackButton(router: Router): void {
  const native = backButtonNative();
  if (!native) return;
  const stop = native.onBack((id) => {
    const step = backStep(router);
    void native.answer(id, step !== "leave").catch(() => {});
    runBackStep(router, step);
  });
  onUnmounted(stop);
}
