/** Music and ambience loop in the Fokus-Modus; chimes mark a moment. */
export type SoundKind = "music" | "ambience" | "chime";

/** A Fokus-Klang whose file lies on the server (docs/focus-sounds.md). */
export type Sound = {
  id: string;
  title: string;
  kind: SoundKind;
  /** Changes with the file; part of its address, so a cached copy never goes stale. */
  version: string;
};

/** `GET /sounds`: the sounds whose file lies on the server; may be none. */
export type SoundListResponse = {
  sounds: Sound[];
};
