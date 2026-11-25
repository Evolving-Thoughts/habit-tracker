import { apiBaseUrl, CLIENT_ID } from "../api/http";
import { notifyDataChanged } from "./data-sync";

/** Several writes in a row (a drag, a quick add) reload once. */
export const LIVE_DEBOUNCE_MS = 250;

/**
 * Live updates from the person's other open apps (docs/live-sync.md): the
 * server's `GET /live` says "changed" after every write, and the open views
 * load again through the one data channel (`notifyDataChanged`), as after a
 * write here. A change this app made itself (its `CLIENT_ID`) is skipped:
 * its own write already reloads. While the app is hidden the line is
 * closed; coming back, and every reconnect, catches up with one reload,
 * since changes in between were not heard. Returns the way to stop.
 */
export function startLiveSync(): () => void {
  if (typeof EventSource === "undefined") return () => {};
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The line broke since it last opened: the next open catches up. */
  let missed = false;

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(notifyDataChanged, LIVE_DEBOUNCE_MS);
  };
  const open = () => {
    if (source) return;
    source = new EventSource(`${apiBaseUrl}/live`, { withCredentials: true });
    source.addEventListener("changed", (event) => {
      let origin: unknown = null;
      try {
        origin = (
          JSON.parse((event as MessageEvent<string>).data) as {
            origin?: unknown;
          }
        ).origin;
      } catch {
        // Not ours to read: reload anyway, it costs one read.
      }
      if (origin !== CLIENT_ID) changed();
    });
    source.addEventListener("open", () => {
      if (missed) changed();
      missed = false;
    });
    source.addEventListener("error", () => {
      missed = true;
    });
  };
  const close = () => {
    source?.close();
    source = null;
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      close();
      missed = true;
    } else open();
  };

  if (document.visibilityState !== "hidden") open();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    clearTimeout(timer);
    close();
  };
}
