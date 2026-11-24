/**
 * The focus sounds the app knows. The audio itself is not in the
 * repository (ElevenLabs' terms forbid publishing the files on their own):
 * it lives in SOUNDS_DIR on the server, and only the entries whose file is
 * there are offered. Prompts that made them: scripts/sounds/prompts.json.
 */
export type SoundKind = 'music' | 'ambience' | 'chime';

export interface SoundEntry {
  id: string;
  title: string;
  kind: SoundKind;
  file: string;
}

export const SOUND_CATALOG: readonly SoundEntry[] = [
  {
    id: 'lofi-warm',
    title: 'Lo-Fi warm',
    kind: 'music',
    file: 'lofi-warm.ogg',
  },
  {
    id: 'lofi-soft',
    title: 'Lo-Fi sanft',
    kind: 'music',
    file: 'lofi-soft.ogg',
  },
  {
    id: 'lofi-rain-evening',
    title: 'Lo-Fi Regenabend',
    kind: 'music',
    file: 'lofi-rain-evening.ogg',
  },
  {
    id: 'piano-calm',
    title: 'Ruhiges Klavier',
    kind: 'music',
    file: 'piano-calm.ogg',
  },
  {
    id: 'ambient-drift',
    title: 'Ambient-Klangflächen',
    kind: 'music',
    file: 'ambient-drift.ogg',
  },
  {
    id: 'guitar-soft',
    title: 'Akustikgitarre',
    kind: 'music',
    file: 'guitar-soft.ogg',
  },
  { id: 'rain', title: 'Regen', kind: 'ambience', file: 'rain.ogg' },
  { id: 'cafe', title: 'Café', kind: 'ambience', file: 'cafe.ogg' },
  {
    id: 'forest-stream',
    title: 'Wald mit Bach',
    kind: 'ambience',
    file: 'forest-stream.ogg',
  },
  {
    id: 'fireplace',
    title: 'Kaminfeuer',
    kind: 'ambience',
    file: 'fireplace.ogg',
  },
  {
    id: 'chime-reached',
    title: 'Soll erreicht',
    kind: 'chime',
    file: 'chime-reached.ogg',
  },
  {
    id: 'chime-done',
    title: 'Erledigt',
    kind: 'chime',
    file: 'chime-done.ogg',
  },
  {
    id: 'chime-milestone',
    title: 'Meilenstein',
    kind: 'chime',
    file: 'chime-milestone.ogg',
  },
];
