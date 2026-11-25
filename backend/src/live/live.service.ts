import { Injectable } from '@nestjs/common';

/** Tells a person's open apps that their data changed (docs/live-sync.md). */
type Listener = (origin: string | null) => void;

/**
 * The one place that knows who is listening. A change names its origin
 * (the app that made it, `X-Client-Id`), so that app can skip the reload
 * it does not need. Nothing about the change itself goes out: the apps
 * read what they show anew, with their own session.
 */
@Injectable()
export class LiveService {
  private readonly listeners = new Map<string, Set<Listener>>();

  /** Listens for one person's changes; returns the way to stop. */
  subscribe(userId: string, listener: Listener): () => void {
    const own = this.listeners.get(userId) ?? new Set<Listener>();
    own.add(listener);
    this.listeners.set(userId, own);
    return () => {
      own.delete(listener);
      if (!own.size) this.listeners.delete(userId);
    };
  }

  /** Something of this person changed: every open app of theirs hears it. */
  notify(userId: string, origin: string | null = null): void {
    for (const listener of this.listeners.get(userId) ?? []) listener(origin);
  }

  /** How many apps of this person listen right now (for tests). */
  listening(userId: string): number {
    return this.listeners.get(userId)?.size ?? 0;
  }
}
