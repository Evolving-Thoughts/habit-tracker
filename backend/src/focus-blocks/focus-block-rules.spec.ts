import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertListChangeAllowed,
  assertLiftable,
  blockApplies,
  blockShape,
  hardcoreEndsAt,
  hostBlocked,
  hostMatches,
  lapsedReason,
  lapsesAt,
  normalizeDomain,
  normalizePackage,
  SOFT_BLOCK_MAX_MS,
  type BlockTiming,
  type HostPolicy,
} from './focus-block-rules';

const MINUTE = 60_000;
const START = new Date('2026-11-23T10:00:00.000Z');
const at = (minutes: number) => new Date(START.getTime() + minutes * MINUTE);

describe('blockApplies', () => {
  const running = {
    enabled: true,
    trigger: 'stopwatch',
    thresholdMinutes: 15,
  } as const;
  const on = { ...running, trigger: 'threshold' } as const;
  const off = { ...on, enabled: false } as const;

  it('blocks whenever the stopwatch runs, with or without a Soll', () => {
    expect(blockApplies(running, 'default', null)).toBe(true);
    expect(blockApplies(running, 'default', 5)).toBe(true);
    expect(blockApplies(running, 'always', null)).toBe(true);
    expect(blockApplies(running, 'never', 60)).toBe(false);
    expect(blockApplies({ ...running, enabled: false }, 'default', 60)).toBe(
      false,
    );
  });

  it('blocks with the threshold trigger from the threshold on, never without a Soll', () => {
    expect(blockApplies(on, 'default', 15)).toBe(true);
    expect(blockApplies(on, 'default', 60)).toBe(true);
    expect(blockApplies(on, 'default', 14)).toBe(false);
    expect(blockApplies(on, 'default', null)).toBe(false);
  });

  it('does nothing by default while Einstellungen have it off', () => {
    expect(blockApplies(off, 'default', 60)).toBe(false);
  });

  it('lets a quest or daily decide for itself', () => {
    expect(blockApplies(off, 'always', null)).toBe(true);
    expect(blockApplies(on, 'always', 5)).toBe(true);
    expect(blockApplies(on, 'never', 60)).toBe(false);
  });
});

describe('blockShape', () => {
  it('gives Soft no end', () => {
    expect(blockShape('soft', 'stopwatch', 30, 0, START)).toEqual({
      mode: 'soft',
      endsAt: null,
    });
    expect(blockShape('soft', 'threshold', 30, 0, START)).toEqual({
      mode: 'soft',
      endsAt: null,
    });
  });

  it('binds Hardcore to the stopwatch with the stopwatch trigger, Soll or not', () => {
    expect(blockShape('hardcore', 'stopwatch', null, 0, START)).toEqual({
      mode: 'hardcore',
      endsAt: null,
    });
    expect(blockShape('hardcore', 'stopwatch', 30, 0, START)).toEqual({
      mode: 'hardcore',
      endsAt: null,
    });
  });

  it('ends Hardcore at the Soll with the threshold trigger, else starts Soft', () => {
    expect(blockShape('hardcore', 'threshold', 25, 10 * MINUTE, START)).toEqual(
      { mode: 'hardcore', endsAt: at(15) },
    );
    expect(blockShape('hardcore', 'threshold', null, 0, START)).toEqual({
      mode: 'soft',
      endsAt: null,
    });
  });
});

describe('Hardcore end', () => {
  it('ends when the stopwatch reaches the Soll, counted from the start', () => {
    expect(hardcoreEndsAt(25, 10 * MINUTE, START)).toEqual(at(15));
    expect(hardcoreEndsAt(25, 0, START)).toEqual(at(25));
  });

  it('has no end without a Soll still ahead', () => {
    expect(hardcoreEndsAt(null, 0, START)).toBeNull();
    expect(hardcoreEndsAt(25, 25 * MINUTE, START)).toBeNull();
    expect(hardcoreEndsAt(25, 40 * MINUTE, START)).toBeNull();
  });

  const hardcore: BlockTiming = {
    mode: 'hardcore',
    startedAt: START,
    endsAt: at(20),
    endedAt: null,
  };
  const soft: BlockTiming = {
    mode: 'soft',
    startedAt: START,
    endsAt: null,
    endedAt: null,
  };

  it('holds Hardcore until its moment, then counts it as reached', () => {
    expect(lapsedReason(hardcore, at(19))).toBeNull();
    expect(lapsedReason(hardcore, at(20))).toBe('target_reached');
    expect(lapsesAt(hardcore)).toEqual(at(20));
  });

  it('holds Hardcore without a moment until twelve hours, never liftable', () => {
    const bound: BlockTiming = { ...hardcore, endsAt: null };
    expect(lapsedReason(bound, at(600))).toBeNull();
    const late = new Date(START.getTime() + SOFT_BLOCK_MAX_MS);
    expect(lapsedReason(bound, late)).toBe('expired');
    expect(lapsesAt(bound)).toEqual(late);
    expect(() => assertLiftable(bound, at(5))).toThrow(ConflictException);
  });

  it('lifts a forgotten Soft block after twelve hours', () => {
    expect(lapsedReason(soft, at(60))).toBeNull();
    const late = new Date(START.getTime() + SOFT_BLOCK_MAX_MS);
    expect(lapsedReason(soft, late)).toBe('expired');
    expect(lapsesAt(soft)).toEqual(late);
  });

  it('refuses to lift Hardcore early with 409 HARDCORE_BLOCK', () => {
    let error: unknown;
    try {
      assertLiftable(hardcore, at(5));
    } catch (cause) {
      error = cause;
    }
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'HARDCORE_BLOCK',
    });
    expect(() => assertLiftable(hardcore, at(20))).not.toThrow();
    expect(() => assertLiftable(soft, at(1))).not.toThrow();
  });

  it('lets the lists only get stricter during Hardcore', () => {
    expect(() =>
      assertListChangeAllowed(true, { list: 'block', action: 'add' }),
    ).not.toThrow();
    for (const change of [
      { list: 'block', action: 'remove' },
      { list: 'allow', action: 'add' },
      { list: 'allow', action: 'remove' },
    ] as const)
      expect(() => assertListChangeAllowed(true, change)).toThrow(
        ConflictException,
      );
    expect(() =>
      assertListChangeAllowed(false, { list: 'allow', action: 'add' }),
    ).not.toThrow();
  });
});

describe('list entries', () => {
  it('reduces a typed website to its host', () => {
    expect(normalizeDomain('youtube.com')).toBe('youtube.com');
    expect(normalizeDomain(' https://www.YouTube.com/watch?v=1 ')).toBe(
      'youtube.com',
    );
    expect(normalizeDomain('*.reddit.com')).toBe('reddit.com');
    expect(normalizeDomain('news.ycombinator.com:443/')).toBe(
      'news.ycombinator.com',
    );
    expect(normalizeDomain('müller.de')).toBe('xn--mller-kva.de');
  });

  it('refuses what is no website', () => {
    for (const input of ['', 'youtube', '192.168.0.1', 'a..b', 'exa mple.com'])
      expect(() => normalizeDomain(input)).toThrow(BadRequestException);
  });

  it('takes Android package names only', () => {
    expect(normalizePackage(' com.google.android.youtube ')).toBe(
      'com.google.android.youtube',
    );
    for (const input of ['youtube', 'com..x', '1com.x', 'com.x-y'])
      expect(() => normalizePackage(input)).toThrow(BadRequestException);
  });
});

describe('host matching', () => {
  it('covers the host and every subdomain, nothing that only ends alike', () => {
    expect(hostMatches('youtube.com', 'youtube.com')).toBe(true);
    expect(hostMatches('m.youtube.com', 'youtube.com')).toBe(true);
    expect(hostMatches('www.m.YouTube.com.', 'youtube.com')).toBe(true);
    expect(hostMatches('notyoutube.com', 'youtube.com')).toBe(false);
    expect(hostMatches('youtube.com.evil.org', 'youtube.com')).toBe(false);
  });

  const policy: HostPolicy = {
    listMode: 'blocklist',
    blocked: ['youtube.com', 'reddit.com'],
    allowed: ['wikipedia.org'],
    fixedAllowed: ['plan.evolving-thoughts.com'],
  };

  it('blocks the Sperrliste in Sperrliste mode', () => {
    expect(hostBlocked('m.youtube.com', policy)).toBe(true);
    expect(hostBlocked('old.reddit.com', policy)).toBe(true);
    expect(hostBlocked('de.wikipedia.org', policy)).toBe(false);
    expect(hostBlocked('example.com', policy)).toBe(false);
  });

  it('blocks everything but the Erlaubt-Liste in strict mode', () => {
    const strict: HostPolicy = { ...policy, listMode: 'allowlist' };
    expect(hostBlocked('de.wikipedia.org', strict)).toBe(false);
    expect(hostBlocked('example.com', strict)).toBe(true);
    expect(hostBlocked('m.youtube.com', strict)).toBe(true);
  });

  it('never blocks the app itself', () => {
    expect(
      hostBlocked('plan.evolving-thoughts.com', {
        ...policy,
        listMode: 'allowlist',
      }),
    ).toBe(false);
    expect(
      hostBlocked('plan.evolving-thoughts.com', {
        ...policy,
        blocked: ['evolving-thoughts.com'],
      }),
    ).toBe(false);
  });
});
