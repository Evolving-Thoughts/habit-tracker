import type { EntityManager } from 'typeorm';
import type { PushDeliveryEntity } from './push.entities';
import type { SendOptions } from './push.transport';

/**
 * One kind of push notification, as the generic queue in `PushService`
 * sees it. A kind says who may be due, what to queue under the person's
 * lock, and whether a queued delivery is still wanted; queueing, fan-out
 * over the person's devices, retry and sending exist once, in the service.
 */

export type PushKindName = PushDeliveryEntity['kind'];

/** Someone who may be due now; the decision is taken again under their lock. */
export type PushCandidate = { userId: string };

/** What to queue once on each of the person's live devices. */
export type DueDelivery = Pick<
  PushDeliveryEntity,
  'timerId' | 'day' | 'expiresAt'
>;

/** A delivery that should still show; `title` is only for the confirm answer. */
export type StillWanted = { title?: string };

export interface PushKind<C extends PushCandidate = PushCandidate> {
  /** The `kind` of the delivery rows this kind writes. */
  readonly name: PushKindName;
  /** The longest the push may wait at the provider, in seconds. */
  readonly maxTtlSeconds: number;
  /** How the provider treats the push; none sends with high urgency. */
  readonly options?: SendOptions;
  /** A cheap first pass without locks over who may be due at `now`. */
  candidates(db: EntityManager, now: Date): Promise<C[]>;
  /**
   * Under the person's lock: marks what it handles and returns the delivery
   * to queue on every device, or null when nothing goes out.
   */
  due(
    manager: EntityManager,
    candidate: C,
    now: Date,
  ): Promise<DueDelivery | null>;
  /**
   * Under the person's lock, before sending and when the service worker
   * asks to show it: null once the delivery should no longer show.
   */
  stillWanted(
    manager: EntityManager,
    delivery: PushDeliveryEntity,
    now: Date,
  ): Promise<StillWanted | null>;
  /** What the push names besides the delivery itself: never a title. */
  payload(delivery: PushDeliveryEntity): object;
}
