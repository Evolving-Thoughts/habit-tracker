<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  deleteMonthChallenge,
  endMonthChallenge,
  updateMonthChallenge,
} from "../api/month-challenges.api";
import ActionMenu from "./ActionMenu.vue";
import AppIcon from "./AppIcon.vue";
import ModalDialog from "./ModalDialog.vue";
import MonthChallengeDialog from "./MonthChallengeDialog.vue";
import { SECTION_QUERY, sectionId } from "../routes";
import type { HabitResponse } from "../types/habit";
import type {
  MonthChallenge,
  MonthChallenges,
} from "../types/month-challenge";
import type { MenuEntry } from "../utils/row-actions";
import {
  barShare,
  barText,
  canPrepareNext,
  monthKeyOf,
  monthName,
  monthTitle,
  nextMonthKey,
  progressLine,
  resultLabel,
  statusLine,
} from "../utils/month-challenge";

/**
 * Dailies › Monats-Challenge: this month's challenge with its progress and
 * reminder, next month's once set (from the 16th "Challenge für Dezember
 * festlegen"), and the earlier ones, newest first, with their honest
 * result. Every change goes to the server and the view reloads.
 */
const props = defineProps<{
  overview: MonthChallenges;
  /** All Dailies; the active ones can carry a challenge. */
  habits: HabitResponse[];
  busy: boolean;
}>();
const emit = defineEmits<{
  /** A challenge changed; the view reloads and says `message` (if any). */
  changed: [message: string];
  /** A dialog is open or a change runs: the view holds still. */
  active: [value: boolean];
}>();

const section = ref<HTMLElement | null>(null);
const today = computed(() => props.overview.today);
const currentKey = computed(() => monthKeyOf(today.value));
const nextKey = computed(() => nextMonthKey(currentKey.value));
const current = computed(() => props.overview.current);
const next = computed(() => props.overview.next);
const activeHabits = computed(() =>
  props.habits.filter((habit) => habit.isActive),
);

/* The months a new challenge can take: this one and the next, if free. */
const freeMonths = computed(() => [
  ...(current.value ? [] : [currentKey.value]),
  ...(next.value ? [] : [nextKey.value]),
]);
const creating = ref<string | null>(null);
const ending = ref<MonthChallenge | null>(null);
const deleting = ref<MonthChallenge | null>(null);
const writing = ref(false);
const errorMessage = ref<string | null>(null);
const savedId = ref<number | null>(null);
watch(
  () => !!creating.value || !!ending.value || !!deleting.value || writing.value,
  (value) => emit("active", value),
);

let lastTrigger: HTMLElement | null = null;
function remember(): void {
  lastTrigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
const returnFocus = () =>
  lastTrigger?.isConnected
    ? lastTrigger
    : (section.value?.querySelector<HTMLElement>("h2") ?? null);

function openCreate(month: string): void {
  if (props.busy) return;
  errorMessage.value = null;
  remember();
  creating.value = month;
}
function onCreated(title: string): void {
  creating.value = null;
  emit("changed", `Monats-Challenge mit „${title}“ gestartet.`);
}

/** Changes still go where the challenge runs or is to come. */
const editable = (challenge: MonthChallenge) =>
  challenge.status === "running" || challenge.status === "upcoming";

function menu(challenge: MonthChallenge): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (challenge.status === "running")
    entries.push({
      id: "end",
      label: "Challenge beenden",
      icon: "stop",
      run: () => {
        remember();
        ending.value = challenge;
      },
    });
  entries.push({
    id: "delete",
    label: "Löschen",
    ariaLabel: `Challenge ${challenge.title} löschen`,
    icon: "trash",
    last: entries.length > 0,
    run: () => {
      remember();
      deleting.value = challenge;
    },
  });
  return entries;
}

async function write(
  step: () => Promise<unknown>,
  message: string,
): Promise<boolean> {
  if (writing.value) return false;
  writing.value = true;
  errorMessage.value = null;
  try {
    await step();
    emit("changed", message);
    return true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Monats-Challenge konnte nicht geändert werden.";
    return false;
  } finally {
    writing.value = false;
  }
}

async function confirmEnd(): Promise<void> {
  const challenge = ending.value;
  if (!challenge) return;
  if (
    await write(
      () => endMonthChallenge(challenge.id),
      `Monats-Challenge „${challenge.title}“ beendet.`,
    )
  )
    ending.value = null;
}
async function confirmDelete(): Promise<void> {
  const challenge = deleting.value;
  if (!challenge) return;
  if (
    await write(
      () => deleteMonthChallenge(challenge.id),
      `Monats-Challenge „${challenge.title}“ gelöscht.`,
    )
  )
    deleting.value = null;
}

async function saveReminder(
  challenge: MonthChallenge,
  time: string | null,
): Promise<void> {
  savedId.value = null;
  if (
    await write(
      () => updateMonthChallenge(challenge.id, time),
      // Said beside the switch ("Gespeichert."), not again at the top.
      "",
    )
  )
    savedId.value = challenge.id;
}
function onTime(challenge: MonthChallenge, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  // Only a whole time is saved; an emptied field waits.
  if (/^\d{2}:\d{2}$/.test(value) && value !== challenge.reminderTime)
    void saveReminder(challenge, value);
}

/* Opened from Heute's card (?abschnitt=challenge): start at the title. */
const route = useRoute();
onMounted(async () => {
  if (route.query[SECTION_QUERY] !== "challenge") return;
  await nextTick();
  const title = section.value?.querySelector<HTMLElement>("h2");
  if (!title) return;
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
});
</script>

<template>
  <section
    :id="sectionId('challenge')"
    ref="section"
    class="challenge-section"
    aria-labelledby="challenge-section-title"
  >
    <h2 id="challenge-section-title" class="section-title challenge-section__title">
      <AppIcon name="challenge" />Monats-Challenge
    </h2>

    <p v-if="errorMessage" class="form-error challenge-section__error" role="alert">
      {{ errorMessage }}
    </p>

    <template
      v-for="(challenge, index) in [current, next]"
      :key="challenge?.id ?? `none-${index}`"
    >
      <article
        v-if="challenge"
        class="challenge-item card"
        :data-challenge-month="challenge.month"
        :aria-labelledby="`challenge-${challenge.id}`"
      >
        <div class="challenge-item__head">
          <div class="challenge-item__names">
            <p class="challenge-item__month">{{ monthTitle(challenge.month) }}</p>
            <h3 :id="`challenge-${challenge.id}`" class="challenge-item__title">
              {{ challenge.title }}
            </h3>
          </div>
          <ActionMenu
            :title="challenge.title"
            :entries="menu(challenge)"
            :disabled="busy"
          />
        </div>
        <p class="challenge-item__status">
          <AppIcon
            v-if="challenge.status === 'succeeded'"
            name="check"
            class="challenge-item__check"
          />{{ statusLine(challenge) }}
        </p>
        <span
          v-if="challenge.status !== 'upcoming' && challenge.total > 0"
          class="challenge-item__bar"
          role="progressbar"
          :aria-label="`Monats-Challenge ${challenge.title}`"
          :aria-valuenow="challenge.done"
          aria-valuemin="0"
          :aria-valuemax="challenge.total"
          :aria-valuetext="barText(challenge)"
        >
          <span :style="{ width: `${barShare(challenge)}%` }" />
        </span>
        <p v-if="challenge.habitId === null" class="challenge-item__hint">
          Das Daily wurde gelöscht; das Ergebnis bleibt, wie es war.
        </p>
        <!-- The reminder: a switch and the time, each saved at once. -->
        <div v-if="editable(challenge)" class="challenge-item__reminder">
          <span
            :id="`challenge-${challenge.id}-reminder`"
            class="challenge-item__label"
            >Täglich erinnern</span
          >
          <input
            v-if="challenge.reminderTime"
            class="input challenge-item__time"
            type="time"
            step="60"
            :name="`challengeReminder-${challenge.id}`"
            :aria-label="`Erinnerung an ${challenge.title} um`"
            :value="challenge.reminderTime"
            :disabled="busy || writing"
            @change="onTime(challenge, $event)"
          />
          <button
            class="switch"
            type="button"
            role="switch"
            :aria-labelledby="`challenge-${challenge.id}-reminder`"
            :aria-checked="challenge.reminderTime !== null"
            :disabled="busy || writing"
            @click="
              saveReminder(challenge, challenge.reminderTime ? null : '19:00')
            "
          >
            <span class="switch__track" aria-hidden="true">
              <span class="switch__thumb" />
            </span>
          </button>
        </div>
        <p
          v-if="editable(challenge)"
          class="challenge-item__saved"
          role="status"
        >
          {{ savedId === challenge.id ? "Gespeichert." : "" }}
        </p>
      </article>
    </template>

    <div v-if="!current" class="challenge-section__empty">
      <p>
        Ein Daily, einen ganzen Monat lang in seinem Rhythmus. Wähle eins für
        {{ monthName(currentKey) }}.
      </p>
      <button
        class="btn btn--primary"
        type="button"
        :disabled="busy"
        @click="openCreate(currentKey)"
      >
        <AppIcon name="challenge" />Challenge starten
      </button>
    </div>
    <button
      v-if="current && !next && canPrepareNext(today)"
      class="btn challenge-section__prepare"
      type="button"
      :disabled="busy"
      @click="openCreate(nextKey)"
    >
      <AppIcon name="plus" />Challenge für {{ monthName(nextKey) }} festlegen
    </button>

    <template v-if="overview.past.length">
      <h3 class="challenge-section__subtitle">Frühere Challenges</h3>
      <ul class="challenge-history card">
        <li
          v-for="challenge in overview.past"
          :key="challenge.id"
          class="challenge-history__row"
        >
          <span class="challenge-history__month">{{
            monthTitle(challenge.month)
          }}</span>
          <span class="challenge-history__title">{{ challenge.title }}</span>
          <span class="challenge-history__result">
            <AppIcon
              v-if="challenge.status === 'succeeded'"
              name="check"
              class="challenge-history__check"
            />{{ resultLabel(challenge) }}
            <span
              v-if="challenge.status !== 'succeeded' && challenge.total > 0"
              class="challenge-history__detail"
              >({{ challenge.done }} von {{ challenge.total }})</span
            >
          </span>
        </li>
      </ul>
    </template>

    <MonthChallengeDialog
      v-if="creating"
      :habits="activeHabits"
      :months="freeMonths"
      :initial-month="creating"
      :today="today"
      :return-focus="returnFocus"
      @close="creating = null"
      @created="onCreated"
    />

    <ModalDialog
      v-if="ending"
      title="Challenge beenden"
      :busy="writing"
      :return-focus="returnFocus"
      focus-selector="[data-keep-challenge]"
      @close="ending = null"
    >
      <div class="challenge-confirm">
        <p>
          „{{ ending.title }}“ endet heute und bleibt mit dem Stand bis heute
          bei den Challenges<template v-if="progressLine(ending)">
            ({{ progressLine(ending) }})</template
          >. Ein heute noch offener Lauf zählt dann nicht mehr.
        </p>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <div class="challenge-confirm__actions">
          <button
            class="btn btn--primary"
            type="button"
            data-primary
            :disabled="writing"
            @click="confirmEnd"
          >
            Ja, beenden
          </button>
          <button
            class="btn"
            type="button"
            data-keep-challenge
            :disabled="writing"
            @click="ending = null"
          >
            Weiterlaufen lassen
          </button>
        </div>
      </div>
    </ModalDialog>

    <ModalDialog
      v-if="deleting"
      title="Challenge löschen"
      :busy="writing"
      :return-focus="returnFocus"
      focus-selector="[data-cancel-delete]"
      @close="deleting = null"
    >
      <div class="challenge-confirm">
        <p>
          „{{ deleting.title }}“ ({{ monthTitle(deleting.month) }}) wirklich
          löschen? Die Challenge verschwindet; das Daily und seine Läufe
          bleiben.
        </p>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <div class="challenge-confirm__actions">
          <button
            class="btn btn--danger"
            type="button"
            data-test="confirm-delete"
            :disabled="writing"
            @click="confirmDelete"
          >
            Ja, löschen
          </button>
          <button
            class="btn"
            type="button"
            data-cancel-delete
            :disabled="writing"
            @click="deleting = null"
          >
            Nicht löschen
          </button>
        </div>
      </div>
    </ModalDialog>
  </section>
</template>

<style scoped>
.challenge-section {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  scroll-margin-top: var(--space-5);
}

.challenge-section p {
  margin: 0;
}

.challenge-section__title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: 0;
}

.challenge-section__title :deep(svg) {
  color: var(--color-ink-muted);
}

.challenge-item {
  display: grid;
  gap: var(--space-1);
}

.challenge-item__head {
  display: flex;
  gap: var(--space-2);
  align-items: start;
  justify-content: space-between;
}

.challenge-item__names {
  min-width: 0;
}

.challenge-item__month {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.challenge-item__title {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.challenge-item__status {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  color: var(--color-ink);
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.challenge-item__check,
.challenge-history__check {
  width: 1.125rem;
  height: 1.125rem;
}

/* A share in ink, the same thin bar as on Heute; never a warning colour. */
.challenge-item__bar {
  display: block;
  width: min(100%, 20rem);
  height: 0.375rem;
  margin-top: var(--space-1);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.challenge-item__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
}

.challenge-item__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.challenge-item__reminder {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  min-height: var(--tap);
  margin-top: var(--space-2);
}

.challenge-item__label {
  margin-right: auto;
  font-weight: 700;
}

.challenge-item__time {
  width: auto;
  min-width: 7.5rem;
  font-variant-numeric: tabular-nums;
}

.challenge-item__saved {
  min-height: 1.25rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.challenge-section__empty {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink-muted);
}

.challenge-section__prepare {
  justify-self: start;
}

.challenge-section__subtitle {
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 800;
}

.challenge-history {
  margin: 0;
  padding-block: var(--space-1);
  list-style: none;
}

/* Month, Daily and result in a row; under each other only when narrow. */
.challenge-history__row {
  display: grid;
  grid-template-columns: minmax(7rem, 9rem) minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-3);
  align-items: baseline;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-line);
}

.challenge-history__row:first-child {
  border-top: 0;
}

.challenge-history__month {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.challenge-history__title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.challenge-history__result {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--color-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.challenge-history__detail {
  color: var(--color-ink-muted);
  font-weight: 600;
}

@media (max-width: 30rem) {
  .challenge-history__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .challenge-history__month {
    grid-column: 1 / -1;
  }
}

.challenge-confirm {
  display: grid;
  gap: var(--space-3);
}

.challenge-confirm p {
  margin: 0;
}

.challenge-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* ModalDialog tints every button; the last step keeps the danger tint. */
.challenge-confirm button.btn--danger:not(:disabled) {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}
</style>
