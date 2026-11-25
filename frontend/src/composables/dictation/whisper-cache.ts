import type { WhisperPlan } from "./whisper-model";

/**
 * Where transformers.js keeps the downloaded model: the browser's Cache
 * Storage under its default key (`env.cacheKey`). Einstellungen asks it
 * whether the model is already on this device and can empty it again.
 */
export const WHISPER_CACHE = "transformers-cache";

/** The plan's weights lie in the cache (at least one of its files). */
export async function whisperStored(plan: WhisperPlan): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    // `has` first: `open` would create an empty cache.
    if (!(await caches.has(WHISPER_CACHE))) return false;
    const cache = await caches.open(WHISPER_CACHE);
    const keys = await cache.keys();
    return keys.some((request) => request.url.includes(`/${plan.model}/`));
  } catch {
    return false;
  }
}

/** Empties the cache: model weights and the runtime transformers.js kept. */
export async function clearWhisperCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(WHISPER_CACHE);
}
