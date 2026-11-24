import type { Sound, SoundListResponse } from "../types/sound";
import { apiBaseUrl, request } from "./http";

/** The sounds whose file lies on the server; may be none. */
export async function listSounds(signal?: AbortSignal): Promise<Sound[]> {
  return (await request<SoundListResponse>("/sounds", { signal })).sounds;
}

/**
 * Where the audio of a sound is fetched (Ogg Opus, with the session cookie,
 * Range supported). Relative to the page unless the API lives elsewhere.
 */
export function soundUrl(sound: Pick<Sound, "id" | "version">): string {
  return `${apiBaseUrl}/sounds/${encodeURIComponent(sound.id)}?v=${encodeURIComponent(sound.version)}`;
}
