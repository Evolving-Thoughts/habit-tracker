import {
  addDays,
  getCurrentDateInTimeZone,
  isValidIsoDate,
  weekStart,
} from "./date";
import {
  findAfterFuer,
  findAfterKeyword,
  findNewAfterKeyword,
  keywordStarts,
  type NamedEntry,
  type NamedFind,
} from "./quest-parse-names";

/**
 * Reads the day and the planned duration out of a quest typed or dictated in
 * German ("Steuererklärung morgen, 30 Minuten"), docs/voice-input.md, and,
 * given the person's campaigns and categories, the ones it names
 * ("Kampagne Buch schreiben", "Kategorie Sport"; quest-parse-names.ts). Pure:
 * the caller shows what was recognised (`matches`, as chips) before anything
 * is saved, and a chip the person discards goes back into the title via
 * `ignore`. Only the first of each kind counts; anything further stays in
 * the title. With `offerNew`, a name after its keyword that matches none
 * of them comes back as one to create (`newCampaign`, `newCategory`).
 */

export type QuestParseKind =
  | "date"
  | "time"
  | "duration"
  | "campaign"
  | "category";

type MatchBase = {
  /** For the chip: "morgen", "Fr., 27.11.", "30 Min.", "Buch schreiben". */
  label: string;
  /** Range in the input, connecting words ("am", "für") included. */
  start: number;
  end: number;
  /** The recognised words as they stand in the input. */
  text: string;
};

export type QuestParseMatch =
  | (MatchBase & { kind: "date"; date: string; isNew?: never })
  | (MatchBase & { kind: "time"; time: string; isNew?: never })
  | (MatchBase & { kind: "duration"; minutes: number; isNew?: never })
  | (MatchBase & {
      kind: "campaign";
      id: number;
      icon?: string | null;
      isNew?: never;
    })
  | (MatchBase & {
      kind: "category";
      id: number;
      mark?: string | null;
      isNew?: never;
    })
  /** A name that matches nothing yet: created on adding; `label` is it. */
  | (MatchBase & { kind: "campaign" | "category"; isNew: true });

export type QuestParse = {
  /** The text without what was recognised; never empty for non-empty input. */
  title: string;
  /** YYYY-MM-DD (Berlin day). */
  scheduledDate?: string;
  /** HH:mm, from "um 13 Uhr", "13:30", "um 9.15 Uhr": an appointment. */
  timeOfDay?: string;
  plannedDurationMinutes?: number;
  /** The campaign named ("Kampagne Buch schreiben", "für Buch schreiben"). */
  campaignId?: number;
  /** The category named ("Kategorie Sport"). */
  categoryId?: number;
  /** A campaign named after its keyword that does not exist yet ("Umzug"). */
  newCampaign?: string;
  /** A category named after its keyword that does not exist yet. */
  newCategory?: string;
  matches: QuestParseMatch[];
};

export type QuestParseOptions = {
  /** YYYY-MM-DD; the app's Berlin day by default. */
  today?: string;
  /** Kinds the person discarded: their words stay in the title. */
  ignore?: readonly QuestParseKind[];
  /** The open campaigns the text may name; `icon` rides along to the chip. */
  campaigns?: readonly { id: number; title: string; icon?: string | null }[];
  /** The person's categories; `mark` rides along to the chip. */
  categories?: readonly { id: number; name: string; mark?: string | null }[];
  /**
   * A name after "Kampagne"/"Kategorie" that matches none of the given list
   * becomes `newCampaign`/`newCategory`; only for a list that was given,
   * and never after a bare "für".
   */
  offerNew?: boolean;
};

/** Longest new names: the server's limits for a quest title and a category. */
export const MAX_CAMPAIGN_TITLE = 200;
export const MAX_CATEGORY_NAME = 60;

/** Longest planned duration taken from text: one day. */
const MAX_MINUTES = 24 * 60;

// Letters (umlauts included) and digits: JavaScript's \b knows only ASCII.
const B = "(?<![\\p{L}\\d])";
const E = "(?![\\p{L}\\d])";

const UNIT_WORDS: Record<string, number> = {
  ein: 1,
  eins: 1,
  eine: 1,
  einen: 1,
  einer: 1,
  zwei: 2,
  zwo: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
};
const NUMBER_WORDS: Record<string, number> = {
  ...UNIT_WORDS,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreißig: 30,
  dreissig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
};
for (const [unit, value] of Object.entries({
  ein: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
}))
  for (const [tens, tensValue] of Object.entries({
    zwanzig: 20,
    dreißig: 30,
    dreissig: 30,
    vierzig: 40,
    fünfzig: 50,
  }))
    NUMBER_WORDS[`${unit}und${tens}`] = value + tensValue;

/** Longest first, so "fünfundzwanzig" wins over "fünf". */
const alternation = (words: Iterable<string>): string =>
  [...words].sort((a, b) => b.length - a.length).join("|");

const NUMBER = `(\\d+(?:[.,]\\d+)?|${alternation(Object.keys(NUMBER_WORDS))})`;
const HOUR_UNIT = "(?:stunden|stunde|std\\.?|h)";
const MINUTE_UNIT = "(?:minuten|minute|min\\.?|mins)";
const HALF = `(anderthalb|(?:${alternation(Object.keys(UNIT_WORDS))})einhalb)`;

const WEEKDAYS: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
};
const MONTHS: Record<string, number> = {
  januar: 1,
  jänner: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mär: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const re = (source: string) => new RegExp(source, "giu");

const RELATIVE = re(`${B}(übermorgen|morgen|heute)${E}`);
const WEEKDAY = re(
  `${B}(?:(nächsten|nächste|nächster|kommenden|kommende|kommender|diesen|diese|dieser)\\s+)?(${alternation(Object.keys(WEEKDAYS))})${E}`,
);
// 3.12. / 3.12 / 3.12.2026 / 3.12.26, but not "1.5 h".
const NUMERIC_DATE = re(
  `${B}(\\d{1,2})\\.(\\d{1,2})(?:\\.(?:(\\d{4}|\\d{2})(?!\\d))?)?(?![\\p{L}\\d]|[.,]\\d|\\s*(?:${HOUR_UNIT}|${MINUTE_UNIT})${E})`,
);
const MONTH_DATE = re(
  `${B}(\\d{1,2})\\.?\\s*(${alternation(Object.keys(MONTHS))})${E}\\.?(?:\\s+(\\d{4})${E})?`,
);

const HALF_HOUR = re(`${B}(?:eine\\s+)?halbe\\s+stunde${E}`);
const QUARTER_HOUR = re(`${B}(?:eine\\s+)?viertel\\s*stunde${E}`);
const THREE_QUARTER_HOUR = re(`${B}(?:eine\\s+)?drei\\s*viertel\\s*stunde${E}`);
const HALVES = re(`${B}${HALF}\\s+${HOUR_UNIT}${E}`);
const HOURS = re(`${B}${NUMBER}\\s*${HOUR_UNIT}(?![\\p{L}\\d])`);
const MINUTES = re(`${B}${NUMBER}\\s*${MINUTE_UNIT}(?![\\p{L}\\d])`);

// A time of day: "13:30" stands alone; with a dot or a bare hour it needs
// "Uhr" after it ("13.30 Uhr", "13 Uhr", "13 Uhr 30", "dreizehn Uhr") or
// "um" before it ("um 9.15"), so "13.11." stays a date.
const HOUR_WORDS = alternation(
  Object.keys(NUMBER_WORDS).filter((word) => NUMBER_WORDS[word]! <= 24),
);
const CLOCK_COLON = re(`${B}(\\d{1,2}):(\\d{2})(?:\\s*uhr)?${E}`);
const CLOCK_DOT_UHR = re(`${B}(\\d{1,2})\\.(\\d{2})\\s*uhr${E}`);
const CLOCK_DOT_UM = re(`${B}um\\s+(\\d{1,2})\\.(\\d{2})${E}`);
const CLOCK_UHR = re(
  `${B}(\\d{1,2}|${HOUR_WORDS})\\s*uhr(?:\\s+(\\d{1,2})(?!\\s*${MINUTE_UNIT}))?${E}`,
);
const TIME_CONNECTORS = ["um", "gegen", "ab"];
const DATE_CONNECTORS = ["am", "bis", "für", "ab"];
const DURATION_CONNECTORS = ["für", "ca.", "circa", "etwa", "ungefähr", "rund"];

type Candidate = {
  start: number;
  end: number;
  value: string | number;
  label: string;
};

function numberValue(raw: string): number | null {
  const word = NUMBER_WORDS[raw.toLowerCase()];
  if (word !== undefined) return word;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function halvesValue(raw: string): number {
  const lower = raw.toLowerCase();
  if (lower === "anderthalb") return 1.5;
  return (UNIT_WORDS[lower.slice(0, -"einhalb".length)] ?? 1) + 0.5;
}

function scan(
  pattern: RegExp,
  text: string,
  read: (match: RegExpExecArray) => Omit<Candidate, "start" | "end"> | null,
): Candidate[] {
  const found: Candidate[] = [];
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const value = read(match);
    if (value)
      found.push({
        ...value,
        start: match.index,
        end: match.index + match[0].length,
      });
  }
  return found;
}

/** The earliest candidate; at the same start, the longest. */
function first(candidates: Candidate[]): Candidate | null {
  return (
    [...candidates].sort((a, b) => a.start - b.start || b.end - a.end)[0] ??
    null
  );
}

/** Takes in connecting words right before the match ("für ca. 30 min"). */
function withConnectors(text: string, start: number, words: string[]): number {
  for (;;) {
    const before = text.slice(0, start);
    const word = words.find((candidate) =>
      new RegExp(
        `(?:^|[\\s,(])${candidate.replace(".", "\\.")}\\s+$`,
        "iu",
      ).test(before),
    );
    if (!word) return start;
    start = before.replace(/\s+$/u, "").length - word.length;
  }
}

const SHORT_WEEKDAY = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];

function dateLabel(date: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = SHORT_WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return `${weekday}, ${day}.${month}.${sameYear ? "" : year}`;
}

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} Min.`;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

function weekdayDate(
  today: string,
  weekday: number,
  modifier?: string,
): string {
  const todayIndex = new Date(`${today}T12:00:00Z`).getUTCDay();
  const lower = modifier?.toLowerCase();
  if (lower?.startsWith("nächst") || lower?.startsWith("kommend"))
    // Next week's: the day in the calendar week after this one.
    return addDays(weekStart(today), 7 + ((weekday + 6) % 7));
  const ahead = (weekday - todayIndex + 7) % 7;
  // "diesen Freitag" on a Friday is today; a bare "Freitag" is the next one.
  return addDays(today, lower?.startsWith("dies") ? ahead : ahead || 7);
}

/** A day without a year that already passed this year means next year. */
function calendarDate(
  day: number,
  month: number,
  year: number | null,
  today: string,
): string | null {
  const iso = (y: number) =>
    `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (year !== null) return isValidIsoDate(iso(year)) ? iso(year) : null;
  const thisYear = Number(today.slice(0, 4));
  const candidate = iso(thisYear);
  if (isValidIsoDate(candidate) && candidate >= today) return candidate;
  return isValidIsoDate(iso(thisYear + 1)) ? iso(thisYear + 1) : null;
}

/** Every day the text names, connecting words not yet taken in. */
function dateCandidates(text: string, today: string): Candidate[] {
  const relative = scan(RELATIVE, text, (match) => {
    const word = match[1].toLowerCase();
    const days = word === "heute" ? 0 : word === "morgen" ? 1 : 2;
    return { value: addDays(today, days), label: word };
  });
  const weekdays = scan(WEEKDAY, text, (match) => {
    const date = weekdayDate(
      today,
      WEEKDAYS[match[2].toLowerCase()],
      match[1] ?? undefined,
    );
    return { value: date, label: dateLabel(date, today) };
  });
  const numeric = scan(NUMERIC_DATE, text, (match) => {
    const year = match[3]
      ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
      : null;
    const date = calendarDate(Number(match[1]), Number(match[2]), year, today);
    return date ? { value: date, label: dateLabel(date, today) } : null;
  });
  const named = scan(MONTH_DATE, text, (match) => {
    const date = calendarDate(
      Number(match[1]),
      MONTHS[match[2].toLowerCase()],
      match[3] ? Number(match[3]) : null,
      today,
    );
    return date ? { value: date, label: dateLabel(date, today) } : null;
  });
  return [...relative, ...weekdays, ...numeric, ...named];
}

function findDate(text: string, today: string): Candidate | null {
  const found = first(dateCandidates(text, today));
  return (
    found && {
      ...found,
      start: withConnectors(text, found.start, DATE_CONNECTORS),
    }
  );
}

/** Every duration the text names, connecting words not yet taken in. */
function durationCandidates(text: string): Candidate[] {
  const fixed = (pattern: RegExp, minutes: number) =>
    scan(pattern, text, () => ({ value: minutes, label: "" }));
  const hours = [
    ...fixed(HALF_HOUR, 30),
    ...fixed(QUARTER_HOUR, 15),
    ...fixed(THREE_QUARTER_HOUR, 45),
    ...scan(HALVES, text, (match) => ({
      value: halvesValue(match[1]) * 60,
      label: "",
    })),
    ...scan(HOURS, text, (match) => {
      const value = numberValue(match[1]);
      return value === null ? null : { value: value * 60, label: "" };
    }),
  ];
  const minutes = scan(MINUTES, text, (match) => {
    const value = numberValue(match[1]);
    return value === null ? null : { value, label: "" };
  });
  // "1 Stunde und 30 Minuten", "2 h 15 min": one duration.
  const combined = hours.map((hour) => {
    const next = minutes.find(
      (minute) =>
        minute.start >= hour.end &&
        /^\s+(?:und\s+)?$/iu.test(text.slice(hour.end, minute.start)),
    );
    return next
      ? {
          ...hour,
          end: next.end,
          value: Number(hour.value) + Number(next.value),
        }
      : hour;
  });
  return [...combined, ...minutes].filter((candidate) => {
    const value = Math.round(Number(candidate.value));
    return value >= 1 && value <= MAX_MINUTES;
  });
}

function findDuration(text: string): Candidate | null {
  const found = first(durationCandidates(text));
  if (!found) return null;
  const value = Math.round(Number(found.value));
  return {
    ...found,
    value,
    label: durationLabel(value),
    start: withConnectors(text, found.start, DURATION_CONNECTORS),
  };
}

/** "13:05" from an hour and minutes; null outside the day. */
function clock(hour: number | null, minute: number): string | null {
  if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23)
    return null;
  if (minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The first time of day the text names, "um" before it taken in. */
function findTime(text: string): Candidate | null {
  const read =
    (hourAt: number, minuteAt: number) =>
    (match: RegExpExecArray): Omit<Candidate, "start" | "end"> | null => {
      const time = clock(
        numberValue(match[hourAt]!),
        match[minuteAt] ? Number(match[minuteAt]) : 0,
      );
      return time ? { value: time, label: `${time} Uhr` } : null;
    };
  const found = first([
    ...scan(CLOCK_COLON, text, read(1, 2)),
    ...scan(CLOCK_DOT_UHR, text, read(1, 2)),
    ...scan(CLOCK_DOT_UM, text, read(1, 2)),
    ...scan(CLOCK_UHR, text, read(1, 2)),
  ]);
  return (
    found && {
      ...found,
      start: withConnectors(text, found.start, TIME_CONNECTORS),
    }
  );
}

/** Blanks a range, keeping every other index where it was. */
const blank = (text: string, start: number, end: number) =>
  text.slice(0, start) + " ".repeat(end - start) + text.slice(end);

const CONNECTORS = "und|am|bis|für|ab|um";
const LEADING = new RegExp(
  `^(?:(?:${CONNECTORS})(?=\\s|$)|[,;:.–-])\\s*`,
  "iu",
);
const TRAILING = new RegExp(
  `(?:\\s(?:${CONNECTORS})|\\s*[,;:–-]|\\s+[.!?])$`,
  "iu",
);

function cleanTitle(text: string, removed: Candidate[]): string {
  const parts = [...removed].sort((a, b) => a.start - b.start);
  let title = text;
  parts.forEach((part, index) => {
    title = blank(title, part.start, part.end);
    // "morgen und 30 Minuten": the "und" between two removed parts goes too.
    const next = parts[index + 1];
    if (
      next &&
      /^[\s,]*(?:und)?[\s,]*$/iu.test(text.slice(part.end, next.start))
    )
      title = blank(title, part.end, next.start);
  });
  title = title
    .replace(/\s+/gu, " ")
    // Commas left behind: "Einkaufen, , Milch" → "Einkaufen, Milch".
    .replace(/\s*,(?:\s*,)+/gu, ",")
    .trim();
  // Connecting words and orphaned punctuation at either end.
  let previous: string;
  do {
    previous = title;
    title = title.replace(LEADING, "").replace(TRAILING, "").trim();
  } while (title !== previous);
  title = title.replace(/\s+([,;.!?])/gu, "$1");
  // "Morgen einkaufen" → "Einkaufen": the sentence start keeps its capital.
  const startRemoved = parts.some(
    (part) => text.slice(0, part.start).trim() === "",
  );
  if (startRemoved && /^\p{Lu}/u.test(text.trim()) && title)
    title = title[0].toLocaleUpperCase("de-DE") + title.slice(1);
  return title;
}

/** Campaigns as named entries, once per list (the matcher caches by list). */
const campaignEntries = new WeakMap<object, NamedEntry[]>();
function asEntries(
  campaigns: NonNullable<QuestParseOptions["campaigns"]>,
): NamedEntry[] {
  let entries = campaignEntries.get(campaigns);
  if (!entries) {
    entries = campaigns.map(({ id, title, icon }) => ({ id, name: title, icon }));
    campaignEntries.set(campaigns, entries);
  }
  return entries;
}

const asCandidate = (found: NamedFind): Candidate => ({
  start: found.start,
  end: found.end,
  value: found.entry.id,
  label: found.entry.name,
});

export function parseQuest(
  text: string,
  options: QuestParseOptions = {},
): QuestParse {
  const today = options.today ?? getCurrentDateInTimeZone();
  const ignore = new Set(options.ignore ?? []);
  const matches: QuestParseMatch[] = [];
  const removed: Candidate[] = [];
  let searched = text;

  // Names first: a keyword announces them, and a campaign may be called
  // "Sport am Montag" without the day being meant.
  const campaigns =
    ignore.has("campaign") || !options.campaigns?.length
      ? []
      : asEntries(options.campaigns);
  const campaign = campaigns.length
    ? (findAfterKeyword(searched, "kampagne", campaigns) ??
      findAfterFuer(searched, campaigns))
    : null;
  if (campaign) {
    removed.push(asCandidate(campaign));
    searched = blank(searched, campaign.start, campaign.end);
    matches.push({
      kind: "campaign",
      id: campaign.entry.id,
      icon: campaign.entry.icon ?? null,
      label: campaign.entry.name,
      start: campaign.start,
      end: campaign.end,
      text: text.slice(campaign.start, campaign.end),
    });
  }
  const category =
    ignore.has("category") || !options.categories?.length
      ? null
      : findAfterKeyword(searched, "kategorie", options.categories);
  if (category) {
    removed.push(asCandidate(category));
    searched = blank(searched, category.start, category.end);
    matches.push({
      kind: "category",
      id: category.entry.id,
      mark: category.entry.mark ?? null,
      label: category.entry.name,
      start: category.start,
      end: category.end,
      text: text.slice(category.start, category.end),
    });
  }

  // A name that matches nothing, after its keyword only: it ends where a
  // day, a duration, either keyword or something recognised begins.
  const stops = () => [
    ...removed.map((part) => part.start),
    ...durationCandidates(searched).map((found) =>
      withConnectors(searched, found.start, DURATION_CONNECTORS),
    ),
    ...dateCandidates(searched, today).map((found) =>
      withConnectors(searched, found.start, DATE_CONNECTORS),
    ),
    ...(findTime(searched) ? [findTime(searched)!.start] : []),
    ...keywordStarts(searched, "kampagne"),
    ...keywordStarts(searched, "kategorie"),
  ];
  const offer = (kind: "campaign" | "category", listed: unknown) =>
    options.offerNew === true && listed !== undefined && !ignore.has(kind);
  const newCampaign =
    !campaign && offer("campaign", options.campaigns)
      ? findNewAfterKeyword(searched, "kampagne", stops, MAX_CAMPAIGN_TITLE)
      : null;
  if (newCampaign) {
    removed.push({ ...newCampaign, value: 0, label: newCampaign.name });
    searched = blank(searched, newCampaign.start, newCampaign.end);
    matches.push({
      kind: "campaign",
      isNew: true,
      label: newCampaign.name,
      start: newCampaign.start,
      end: newCampaign.end,
      text: text.slice(newCampaign.start, newCampaign.end),
    });
  }
  const newCategory =
    !category && offer("category", options.categories)
      ? findNewAfterKeyword(searched, "kategorie", stops, MAX_CATEGORY_NAME)
      : null;
  if (newCategory) {
    removed.push({ ...newCategory, value: 0, label: newCategory.name });
    searched = blank(searched, newCategory.start, newCategory.end);
    matches.push({
      kind: "category",
      isNew: true,
      label: newCategory.name,
      start: newCategory.start,
      end: newCategory.end,
      text: text.slice(newCategory.start, newCategory.end),
    });
  }

  // The time of day first, so "13.30 Uhr" is never read as a date, then
  // durations before days, so "1,5 h" is never read as one either.
  const time = ignore.has("time") ? null : findTime(searched);
  if (time) {
    removed.push(time);
    searched = blank(searched, time.start, time.end);
  }
  const duration = ignore.has("duration") ? null : findDuration(searched);
  if (duration) {
    removed.push(duration);
    searched = blank(searched, duration.start, duration.end);
  }
  const date = ignore.has("date") ? null : findDate(searched, today);
  if (date) removed.push(date);

  if (date)
    matches.push({
      kind: "date",
      date: String(date.value),
      label: date.label,
      start: date.start,
      end: date.end,
      text: text.slice(date.start, date.end),
    });
  if (time)
    matches.push({
      kind: "time",
      time: String(time.value),
      label: time.label,
      start: time.start,
      end: time.end,
      text: text.slice(time.start, time.end),
    });
  if (duration)
    matches.push({
      kind: "duration",
      minutes: Number(duration.value),
      label: duration.label,
      start: duration.start,
      end: duration.end,
      text: text.slice(duration.start, duration.end),
    });

  matches.sort((a, b) => a.start - b.start);
  // Nothing recognised changes nothing; everything recognised keeps the text.
  const title =
    (removed.length > 0 && cleanTitle(text, removed)) || text.trim();
  return {
    title,
    ...(date ? { scheduledDate: String(date.value) } : {}),
    ...(time ? { timeOfDay: String(time.value) } : {}),
    ...(duration ? { plannedDurationMinutes: Number(duration.value) } : {}),
    ...(campaign ? { campaignId: campaign.entry.id } : {}),
    ...(category ? { categoryId: category.entry.id } : {}),
    ...(newCampaign ? { newCampaign: newCampaign.name } : {}),
    ...(newCategory ? { newCategory: newCategory.name } : {}),
    matches,
  };
}
