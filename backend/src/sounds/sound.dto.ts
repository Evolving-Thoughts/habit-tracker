import type { SoundKind } from './sound-catalog';

export type SoundResponse = {
  id: string;
  title: string;
  kind: SoundKind;
  /**
   * Changes whenever the file on the server changes. The frontend puts it in
   * the file URL (`/sounds/:id?v=…`), which the browser may then cache for good.
   */
  version: string;
};

export type SoundsResponse = {
  /** Only the sounds whose file is on the server, in catalog order. */
  sounds: SoundResponse[];
};
