<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import WorkLogDialog from "./WorkLogDialog.vue";
import { updateWorkLog, type WorkTarget } from "../api/work-logs.api";
import { withWorkLogSound } from "../composables/action-sounds";
import { notifyViewsChanged } from "../composables/data-sync";
import { useDayClock } from "../composables/useDayClock";
import { useWrites } from "../composables/useWrites";
import type { HistoryResponse, HistoryWorkLog } from "../types/history";
import { campaignMark } from "../utils/category-mark";
import { APP_TIME_ZONE, getCurrentDateInTimeZone } from "../utils/date";
import { dayLabel } from "../utils/history";
import {
  HOUR_REM,
  axisHours,
  calendarBlocks,
  clockLabel,
  drawnEnd,
  formatDuration,
  logBlocks,
  logLabel,
  logTimes,
  planBlocks,
  resizedEdge,
  wallTime,
  type CalendarBlock,
  type LogBlock,
  type Placed,
} from "../utils/logbook";

type Day = HistoryResponse["days"][number];
type Edge = "start" | "end";

/**
 * One day on one hour axis (DESIGN.md › Tageskalender): appointments, timed
 * runs and Google events, the moments untimed entries were ticked off, and
 * the Logbuch's measured stretches, side by side where they overlap, with
 * a "Jetzt" line on today. Heute, the Kalender's day and each column of its
 * week use it.
 *
 * A Logbuch block opens "Abschnitt korrigieren" on a tap; its top and
 * bottom edges drag (pointer events, mouse and touch) to change start and
 * end on a 5-minute grid, never past the other edge and never into the
 * future; Escape cancels the drag. The dialog is the keyboard's way to the
 * same. A tap on empty time, or "Zeit nachtragen" in the head, adds time.
 */
const props = withDefaults(
  defineProps<{
    day: Day;
    today: string;
    /** Loads the day again after a change. */
    reload: (showPageLoading?: boolean) => Promise<void>;
    /** A column of the week: no head, no own hour labels, no own scrolling. */
    compact?: boolean;
    /** The hours the week's columns share; a single day finds its own. */
    hours?: { from: number; to: number };
    /** Stretches whose delete waits behind the undo toast: already out of view. */
    hiddenLogs?: ReadonlySet<number>;
  }>(),
  { compact: false, hours: undefined, hiddenLogs: undefined },
);
const emit = defineEmits<{ removeLog: [log: HistoryWorkLog] }>();

const titleId = useId();
const isToday = computed(() => props.day.date === props.today);
/** Only what has begun can have been worked on. */
const isPastOrToday = computed(() => props.day.date <= props.today);

/* Minutes since midnight in Berlin, moved on each minute while it is today. */
const now = useDayClock((minutes) =>
  isToday.value && minutes < 1439 ? minutes + 1 : null,
);
/** No stretch reaches past now; a past day ends at midnight. */
const latest = computed(() => (isToday.value ? now.value : 24 * 60));

const logs = computed(() =>
  (props.day.work.logs ?? []).filter((log) => !props.hiddenLogs?.has(log.id)),
);
/*
 * The day's total comes from the server, which still counts a stretch whose
 * delete is held back. Until the delete went through, the head shows no
 * figure rather than one that is about to be wrong.
 */
const holdsBack = computed(() =>
  (props.day.work.logs ?? []).some((log) => props.hiddenLogs?.has(log.id)),
);
// Without the held-back stretches, so an entry measured only by them shows
// as done (or as its appointment) instead of vanishing until the undo ends.
const plan = computed(() =>
  planBlocks({ ...props.day, work: { ...props.day.work, logs: logs.value } }),
);
const stretches = computed(() =>
  isPastOrToday.value
    ? logBlocks({ ...props.day.work, logs: logs.value }, props.day.date)
    : [],
);
const blocks = computed(() => calendarBlocks(plan.value, stretches.value));
const axis = computed(
  () => props.hours ?? axisHours([...plan.value, ...stretches.value]),
);
const hourMarks = computed(() =>
  Array.from(
    { length: axis.value.to - axis.value.from + 1 },
    (_, index) => axis.value.from + index,
  ),
);
/** A short block late at night is drawn past the last hour line. */
const overflow = computed(() =>
  Math.max(
    0,
    ...[...plan.value, ...stretches.value].map(
      (block) => drawnEnd(block) - axis.value.to * 60,
    ),
  ),
);
const showsNow = computed(
  () => isToday.value && now.value >= axis.value.from * 60,
);

/** Entries of the day that can take a manual work log. */
const targets = computed<WorkTarget[]>(() => {
  if (!isPastOrToday.value) return [];
  const seen = new Set<string>();
  return [...props.day.items, ...(props.day.planned ?? [])].flatMap(
    (entry) => {
      if (entry.id === null) return [];
      const kind =
        entry.type === "todo" ? ("todo" as const) : ("occurrence" as const);
      const key = `${kind}-${entry.id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ kind, targetId: entry.id, title: entry.title }];
    },
  );
});

/* Saving a dragged edge. */
const error = ref<string | null>(null);
const announcement = ref("");
const { write, isWriting } = useWrites(props.reload, error);

/* The dialog: correct a stretch, or add time. */
type Dialog =
  | { kind: "edit"; log: HistoryWorkLog }
  | { kind: "add"; from?: string; to?: string };
const dialog = ref<Dialog | null>(null);
let opener: HTMLElement | null = null;
function openDialog(next: Dialog, from?: EventTarget | null): void {
  opener = from instanceof HTMLElement ? from : null;
  dialog.value = next;
}
const returnFocus = (): HTMLElement | null =>
  opener?.isConnected ? opener : root.value?.querySelector("h2") ?? null;
function removeLog(log: HistoryWorkLog): void {
  // The block leaves; the focus goes to the head of the column.
  opener = null;
  emit("removeLog", log);
}

const root = ref<HTMLElement | null>(null);
const lane = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);

/** Minutes one pixel of the axis stands for. */
function minutesPerPixel(): number {
  const height = lane.value?.getBoundingClientRect().height ?? 0;
  const total = (axis.value.to - axis.value.from) * 60;
  if (height > 0) return total / height;
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 60 / (HOUR_REM * rem);
}

/*
 * A tap on empty time adds a stretch there: from the quarter hour tapped,
 * for half an hour, never into the future.
 */
function onLaneClick(event: MouseEvent): void {
  if (!targets.value.length || !lane.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("li")) return;
  const offset = event.clientY - lane.value.getBoundingClientRect().top;
  const at =
    Math.floor((axis.value.from * 60 + offset * minutesPerPixel()) / 15) * 15;
  const until = Math.min(at + 30, latest.value);
  if (at < 0 || until - at < 5) return;
  openDialog({ kind: "add", from: clockLabel(at), to: clockLabel(until) });
}

/* Resizing a Logbuch block by its edges. */
type Drag = {
  log: HistoryWorkLog;
  edge: Edge;
  pointerId: number;
  y: number;
  scale: number;
  original: { start: number; end: number };
  start: number;
  end: number;
  handle: HTMLElement;
};
const drag = ref<Drag | null>(null);
/** After a save the block keeps its new place until the reload brings it. */
const settled = ref<{ id: number; start: number; end: number } | null>(null);

/** Only an edge on this day can move; one on the day before or after stays. */
function movable(block: LogBlock, edge: Edge): boolean {
  const day = (instant: string) =>
    getCurrentDateInTimeZone(APP_TIME_ZONE, new Date(instant));
  return edge === "start"
    ? day(block.log.startedAt) === props.day.date
    : day(block.log.endedAt) === props.day.date;
}

function startResize(event: PointerEvent, block: LogBlock, edge: Edge): void {
  if (event.button !== 0 || drag.value || isWriting(`log-${block.log.id}`))
    return;
  event.preventDefault();
  event.stopPropagation();
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture?.(event.pointerId);
  drag.value = {
    log: block.log,
    edge,
    pointerId: event.pointerId,
    y: event.clientY,
    scale: minutesPerPixel(),
    original: { start: block.start, end: block.end },
    start: block.start,
    end: block.end,
    handle,
  };
  error.value = null;
  window.addEventListener("keydown", onDragKey, true);
}
function moveResize(event: PointerEvent): void {
  const current = drag.value;
  if (!current || event.pointerId !== current.pointerId) return;
  const delta = (event.clientY - current.y) * current.scale;
  const from = current.original[current.edge];
  current[current.edge] = resizedEdge(
    current.edge,
    from + delta,
    current.original,
    latest.value,
  );
}
function stopDrag(): Drag | null {
  const current = drag.value;
  if (!current) return null;
  window.removeEventListener("keydown", onDragKey, true);
  if (current.handle.hasPointerCapture?.(current.pointerId))
    current.handle.releasePointerCapture(current.pointerId);
  drag.value = null;
  return current;
}
function endResize(event: PointerEvent): void {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return;
  const done = stopDrag();
  if (
    done &&
    (done.start !== done.original.start || done.end !== done.original.end)
  )
    void saveResize(done);
}
function onDragKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  stopDrag();
}
onBeforeUnmount(stopDrag);

async function saveResize(done: Drag): Promise<void> {
  const { log } = done;
  const startedAt =
    done.edge === "start" ? wallTime(props.day.date, done.start) : log.startedAt;
  const endedAt =
    done.edge === "end" ? wallTime(props.day.date, done.end) : log.endedAt;
  if (!startedAt || !endedAt) {
    error.value = "Diese Uhrzeit gibt es an diesem Tag nicht.";
    return;
  }
  settled.value = { id: log.id, start: done.start, end: done.end };
  const saved = await write(
    () => withWorkLogSound(() => updateWorkLog(log.id, { startedAt, endedAt })),
    {
      key: `log-${log.id}`,
      fallbackError: "Der Abschnitt konnte nicht geändert werden.",
      notify: notifyViewsChanged,
    },
  );
  settled.value = null;
  if (saved)
    announcement.value = `„${log.title}“ geht jetzt von ${clockLabel(done.start)} bis ${clockLabel(done.end)}.`;
}

/** Where a block is drawn: dragged and just saved blocks at their new times. */
function span(block: Placed<CalendarBlock>): { start: number; end: number } {
  if (block.kind !== "log") return block;
  const current = drag.value;
  if (current?.log.id === block.log.id) return current;
  if (settled.value?.id === block.log.id) return settled.value;
  return block;
}
function place(block: Placed<CalendarBlock>) {
  const { start, end } = span(block);
  return {
    "--top": start - axis.value.from * 60,
    "--length": end - start,
    "--column": block.column,
    "--columns": block.columns,
  };
}
const resizing = (block: Placed<CalendarBlock>) =>
  block.kind === "log" && drag.value?.log.id === block.log.id;
/** The live time of a block being dragged, else its stored times. */
function blockTimes(block: Placed<CalendarBlock> & { kind: "log" }): string {
  if (!resizing(block)) return logTimes(block.log);
  const { start, end } = span(block);
  return `${clockLabel(start)}–${clockLabel(end)}`;
}
const stripe = (log: HistoryWorkLog) =>
  campaignMark(log.campaign) ?? "var(--color-mark-none)";

/* Opens on now, on today, or on the first entry, else on the morning. */
async function scrollToStart(): Promise<void> {
  await nextTick();
  const element = scroller.value;
  if (!element || props.compact) return;
  const first = Math.min(
    ...[...plan.value, ...stretches.value].map((block) => block.start),
  );
  const target = isToday.value
    ? now.value - 90
    : Number.isFinite(first)
      ? first - 30
      : 8 * 60;
  element.scrollTop = Math.max(
    0,
    (target - axis.value.from * 60) / minutesPerPixel(),
  );
}
onMounted(scrollToStart);
watch(
  () => props.day.date,
  () => {
    stopDrag();
    dialog.value = null;
    error.value = null;
    void scrollToStart();
  },
);
</script>

<template>
  <section
    ref="root"
    class="day-calendar"
    :class="{
      'day-calendar--compact': compact,
      'day-calendar--today': isToday,
    }"
    :aria-labelledby="compact ? undefined : titleId"
    :aria-label="compact ? dayLabel(day.date) : undefined"
    :style="{
      '--hour': `${HOUR_REM}rem`,
      '--from': axis.from,
      '--hours': axis.to - axis.from,
      '--overflow': overflow,
    }"
  >
    <header v-if="!compact" class="day-calendar__head">
      <h2 :id="titleId" class="day-calendar__title" tabindex="-1">
        <template v-if="isPastOrToday">
          Logbuch
          <span v-if="day.work.minutes && !holdsBack" class="count">{{
            formatDuration(day.work.minutes)
          }}</span>
        </template>
        <template v-else>Termine</template>
      </h2>
      <button
        v-if="targets.length"
        type="button"
        class="btn btn--quiet day-calendar__add"
        @click="openDialog({ kind: 'add' }, $event.currentTarget)"
      >
        <AppIcon name="plus" />Zeit nachtragen
      </button>
    </header>
    <p v-if="error" class="form-error day-calendar__error" role="alert">
      {{ error }}
    </p>
    <div ref="scroller" class="day-calendar__scroller">
      <div class="day-calendar__axis">
        <div v-if="!compact" class="day-calendar__hours" aria-hidden="true">
          <span
            v-for="hour in hourMarks"
            :key="hour"
            :style="{ '--at': hour - axis.from }"
            >{{ String(hour).padStart(2, "0") }}:00</span
          >
          <span
            v-if="showsNow"
            class="day-calendar__now-time"
            :style="{ '--minute-at': now - axis.from * 60 }"
            >{{ clockLabel(now) }}</span
          >
        </div>
        <div
          ref="lane"
          class="day-calendar__lane"
          :class="{ 'day-calendar__lane--addable': targets.length }"
          @click="onLaneClick"
        >
          <ol class="day-calendar__blocks" aria-label="Zeitachse">
            <li
              v-for="block in blocks"
              :key="block.key"
              class="day-calendar__slot"
              :class="{
                'day-calendar__slot--log': block.kind === 'log',
                'day-calendar__slot--short': block.kind === 'log' && span(block).end - span(block).start < 20,
                'day-calendar__slot--mark':
                  block.kind === 'plan' && block.source === 'done',
                'day-calendar__slot--resizing': resizing(block),
              }"
              :style="place(block)"
            >
              <template v-if="block.kind === 'plan'">
                <!-- A record of a moment, not a control: the dot of the history rows. -->
                <!-- Read as one phrase: "Titel, erledigt um 15:59". -->
                <div v-if="block.source === 'done'" class="done-mark">
                  <span class="done-mark__dot" aria-hidden="true"
                    ><AppIcon name="check"
                  /></span>
                  <span class="day-calendar__title-text" aria-hidden="true">{{
                    block.title
                  }}</span>
                  <span class="visually-hidden"
                    >{{ block.title }}, erledigt um {{ block.time }}</span
                  >
                </div>
                <div
                  v-else
                  class="plan-block"
                  :class="{ 'plan-block--event': block.source === 'event' }"
                >
                  <strong class="day-calendar__title-text">{{
                    block.title
                  }}</strong>
                  <span class="day-calendar__meta"
                    >{{ block.time
                    }}<template v-if="block.source === 'event'">
                      · Google</template
                    ></span
                  >
                </div>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="log-block"
                  :style="{ '--campaign-mark': stripe(block.log) }"
                  :title="logLabel(block.log)"
                  :aria-label="`${logLabel(block.log)}, korrigieren`"
                  @click="
                    openDialog(
                      { kind: 'edit', log: block.log },
                      $event.currentTarget,
                    )
                  "
                >
                  <strong class="day-calendar__title-text">{{
                    block.log.title
                  }}</strong>
                  <span class="day-calendar__meta">{{ blockTimes(block) }}</span>
                  <CampaignChip
                    v-if="block.log.campaign && !compact"
                    class="log-block__chip"
                    :campaign="block.log.campaign"
                  />
                </button>
                <!-- Pointer only; the dialog is the keyboard's way to the same. -->
                <span
                  v-if="movable(block, 'start')"
                  class="log-handle log-handle--start"
                  aria-hidden="true"
                  @pointerdown="startResize($event, block, 'start')"
                  @pointermove="moveResize"
                  @pointerup="endResize"
                  @pointercancel="stopDrag"
                />
                <span
                  v-if="movable(block, 'end')"
                  class="log-handle log-handle--end"
                  aria-hidden="true"
                  @pointerdown="startResize($event, block, 'end')"
                  @pointermove="moveResize"
                  @pointerup="endResize"
                  @pointercancel="stopDrag"
                />
              </template>
            </li>
          </ol>
          <div
            v-if="showsNow"
            class="day-calendar__now"
            :style="{ '--minute-at': now - axis.from * 60 }"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
    <p class="visually-hidden" role="status">{{ announcement }}</p>
    <WorkLogDialog
      v-if="dialog"
      :date="day.date"
      :reload="reload"
      :log="dialog.kind === 'edit' ? dialog.log : null"
      :targets="targets"
      :from="dialog.kind === 'add' ? dialog.from : undefined"
      :to="dialog.kind === 'add' ? dialog.to : undefined"
      :return-focus="returnFocus"
      @remove="removeLog"
      @close="dialog = null"
    />
  </section>
</template>

<style scoped>
.day-calendar {
  --minute: calc(var(--hour) / 60);

  display: flex;
  flex-direction: column;
  min-height: 0;
}

.day-calendar__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.day-calendar__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
}

/* Quiet, like the other side ways of the day. */
.day-calendar__add {
  margin-right: calc(var(--space-3) * -1);
}

.day-calendar__error {
  margin: 0 0 var(--space-2);
}

/* A single day scrolls in its own column; the week scrolls all of them. */
.day-calendar__scroller {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: var(--radius-card);
  background: var(--color-surface-faint);
}

.day-calendar--compact .day-calendar__scroller {
  overflow: visible;
  border-radius: 0;
  background: transparent;
}

.day-calendar__axis {
  position: relative;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: var(--space-2);
  height: calc(var(--hours) * var(--hour));
  /* Room for the first label above the first line and blocks drawn past the last. */
  margin: var(--space-3) var(--space-2)
    calc(var(--space-3) + var(--overflow) * var(--minute)) 0;
}

.day-calendar--compact .day-calendar__axis {
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
}

.day-calendar__hours {
  position: relative;
}

.day-calendar__hours > span {
  position: absolute;
  top: calc(var(--at) * var(--hour));
  right: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transform: translateY(-50%);
}

/* The time on the "Jetzt" line, in ink over the hour it passes. */
.day-calendar__hours > .day-calendar__now-time {
  top: calc(var(--minute-at) * var(--minute));
  padding: 0.125rem 0;
  background: var(--color-ground);
  color: var(--color-ink);
  font-weight: 800;
}

.day-calendar__lane {
  position: relative;
  border-top: 1px solid var(--color-line);
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 calc(var(--hour) - 1px),
    var(--color-line) calc(var(--hour) - 1px) var(--hour)
  );
}

.day-calendar__lane--addable {
  cursor: copy;
}

.day-calendar__blocks {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The "Jetzt" line: ink, never orange; a dot where it starts. */
.day-calendar__now {
  position: absolute;
  z-index: 2;
  top: calc(var(--minute-at) * var(--minute));
  right: 0;
  left: 0;
  height: 2px;
  margin-top: -1px;
  border-radius: 2px;
  background: var(--color-ink);
  pointer-events: none;
}

.day-calendar__now::before {
  position: absolute;
  top: 50%;
  left: -0.25rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-ink);
  content: "";
  transform: translateY(-50%);
}

/* Never smaller than a tap target, so a short stretch can still be reached. */
.day-calendar__slot {
  position: absolute;
  top: calc(var(--top) * var(--minute));
  left: calc(var(--column) / var(--columns) * 100%);
  width: calc(100% / var(--columns));
  height: max(calc(var(--tap) + 2px), calc(var(--length) * var(--minute)));
  padding: 1px;
  cursor: default;
}

/* A completion is a moment: a slim mark, nothing to tap. */
.day-calendar__slot--log {
  height: max(1px, calc(var(--length) * var(--minute)));
  padding: 0 1px;
}
.day-calendar__slot--log .log-block { padding-block: 0; }
.day-calendar__slot--log .log-handle { height: min(25%, 0.625rem); }
.day-calendar__slot--short .log-handle { width: 22%; height: var(--tap); top: 50%; transform: translateY(-50%); }
.day-calendar__slot--short .log-handle--start { right: auto; }
.day-calendar__slot--short .log-handle--end { left: auto; }
.day-calendar__slot--short .log-block::after { content: ""; position: absolute; inset-inline: 24%; top: 50%; height: var(--tap); transform: translateY(-50%); }
/*
 * A finger reaches every stretch: an invisible field at least a tap high
 * around its middle, the edges' handles stay on top. The block looks the
 * same; only where it can be touched grows.
 */
@media (pointer: coarse) {
  .day-calendar__slot--log .log-block::after { content: ""; position: absolute; inset-inline: 24%; top: 50%; height: max(100%, var(--tap)); transform: translateY(-50%); }
}
.day-calendar__slot--mark {
  height: calc(1.5rem + 2px);
}

.day-calendar__slot--resizing {
  z-index: 3;
}

.done-mark {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  height: 100%;
  overflow: hidden;
  padding: 0 0.375rem 0 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-flat);
  color: var(--color-ink-muted);
}

/* The filled dot of the history rows: a state, never orange. */
.done-mark__dot {
  display: grid;
  flex: none;
  width: 1rem;
  height: 1rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-ink-muted);
  color: var(--color-surface);
}

.done-mark__dot :deep(svg) {
  width: 0.6875rem;
  height: 0.6875rem;
  stroke-width: 3.5;
}

.plan-block,
.log-block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  border-radius: 0.625rem;
  color: var(--color-ink);
  text-align: left;
}

/* Planned, not measured: the half-white of appointments elsewhere. */
.plan-block {
  background: var(--color-surface-flat);
  box-shadow: inset 0 0 0 1px var(--color-line);
}

/* Read-only events of a Google calendar: the same block without its edge. */
.plan-block--event {
  box-shadow: none;
}

.log-block {
  border: 0;
  background: var(--color-surface);
  box-shadow: inset 0.3125rem 0 0 var(--campaign-mark);
  font: inherit;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.log-block:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.day-calendar__slot--resizing .log-block {
  box-shadow:
    inset 0.3125rem 0 0 var(--campaign-mark),
    var(--shadow-card);
  transform: none;
}

.log-block__chip {
  flex: none;
}

/* The edges of a stretch drag; a thin bar shows where on hover. */
.log-handle {
  position: absolute;
  z-index: 1;
  right: 1px;
  left: 1px;
  height: 0.625rem;
  cursor: ns-resize;
  touch-action: none;
}

.log-handle--start {
  top: 0;
}

.log-handle--end {
  bottom: 0;
}

.log-handle::after {
  position: absolute;
  left: 50%;
  width: 1.5rem;
  height: 0.1875rem;
  border-radius: var(--radius-pill);
  background: var(--color-ink-soft);
  content: "";
  opacity: 0;
  transform: translateX(-50%);
  transition: opacity 160ms var(--ease-out);
}

.log-handle--start::after {
  top: 0.1875rem;
}

.log-handle--end::after {
  bottom: 0.1875rem;
}

@media (hover: hover) {
  .day-calendar__slot:hover .log-handle::after {
    opacity: 1;
  }
}

.day-calendar__slot--resizing .log-handle::after {
  opacity: 1;
}

.day-calendar__title-text {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-calendar__meta {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
