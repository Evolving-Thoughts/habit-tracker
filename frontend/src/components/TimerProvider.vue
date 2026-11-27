<script setup lang="ts">
import { useDevicePushRestore } from "../push/restore";
import { notifyDataChanged } from "../composables/data-sync";
import {
  isValidTimerDuration,
  TIMER_DURATION_MESSAGE,
  TIMER_MAX_MINUTES,
} from "../utils/timer-duration";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useMediaQuery, WIDE_QUERY } from "../composables/useMediaQuery";
import { createTimerController, timerKey } from "../composables/useTimer";
import {
  createFocusBlockController,
  focusBlockKey,
} from "../composables/useFocusBlock";
import { hrefOf } from "../routes";
import { useTargetNotice } from "../composables/useTargetNotice";
import { writeDone } from "../composables/useTicks";
import { startMilestonePriming } from "../composables/action-sounds";
import { formatStopwatch } from "../utils/stopwatch";
import { controlHit } from "../utils/card-click";
import type { MenuEntry } from "../utils/row-actions";
import ActionMenu from "./ActionMenu.vue";
import TimerIconButton from "./TimerIconButton.vue";
import ModalDialog from "./ModalDialog.vue";
import NoticeToast from "./NoticeToast.vue";
import FocusBlockSetupHint from "./FocusBlockSetupHint.vue";
import { startLiveSync } from "../composables/live-sync";

/**
 * Holds the one stopwatch of the signed-in user for everything below it and
 * shows it in a bar that stays in view. A view that shows the stopwatch large
 * itself hides the bar; the dialogs stay available either way. Reaching the
 * Soll is announced once on every view, with the bar or without it.
 *
 * Where the tab bar is at the bottom (a phone, a touch tablet) the bar is
 * docked right above it, like a music player, with its buttons on the right
 * in the thumb's reach. Its height, gap included, is published as
 * `--timer-bar-height` on the root element, so the page's bottom padding,
 * the plus button and the toasts make room; it is 0 while there is no bar
 * and in the wide tier, where the bar sticks to the top as before. Below
 * 40rem it is one line (title, time, pause or resume); Soll ändern,
 * erledigen and beenden wait in its menu.
 */
defineProps<{ hideBar?: boolean }>();

useDevicePushRestore();
const controller = createTimerController();
provide(timerKey, controller);
const { timer, elapsed, reached, error, busy, switching } = controller;
/*
 * The Fokus-Sperre lives beside the stopwatch: the server starts and ends
 * it with every start, resume, pause and stop, wherever they happen, so it
 * is read again whenever the stopwatch changes (`startSync`), and on
 * Android handed to the plugin after every read. While a block holds, the
 * bar says when the phone lacks a permission to enforce it.
 */
const focusBlock = createFocusBlockController();
provide(focusBlockKey, focusBlock);
function openFocus(): void {
  window.location.hash = hrefOf("focus");
}
const stopOpenFocus = focusBlock.native?.onOpenFocus(openFocus);
/** A tap on the bar, not on one of its buttons, opens the Fokus-Modus. */
function openFocusFromBar(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  const bar = event.currentTarget;
  if (!(bar instanceof Element)) return;
  // The words are a link of their own; the buttons keep their own tap.
  if (controlHit(event, bar)) return;
  openFocus();
}
const notice = useTargetNotice(controller);
const editingId = ref<string>();
const editing = ref(false);
const completing = ref(false);
const minutes = ref<string | number>("");
const targetError = ref("");
// A dialog about one stopwatch closes when another one takes its place.
watch(
  () => timer.value?.id,
  () => (editing.value = false),
);
const display = computed(() => formatStopwatch(elapsed.value));

/* Docked at the bottom wherever the tab bar is; its height makes room. */
const wide = useMediaQuery(WIDE_QUERY);
const docked = computed(() => !wide.value);
const bar = ref<HTMLElement | null>(null);
const HEIGHT_PROPERTY = "--timer-bar-height";
function publishHeight(): void {
  const element = bar.value;
  let height = 0;
  if (element && docked.value) {
    const gap = parseFloat(getComputedStyle(element).marginBottom) || 0;
    height = Math.ceil(element.getBoundingClientRect().height + gap);
  }
  document.documentElement.style.setProperty(HEIGHT_PROPERTY, `${height}px`);
}
watch(
  bar,
  (element, _previous, onCleanup) => {
    publishHeight();
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publishHeight);
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  },
  { flush: "post", immediate: true },
);
watch(docked, publishHeight, { flush: "post" });
function openTarget(): void {
  editingId.value = timer.value?.id;
  minutes.value = timer.value?.targetMinutes ?? "";
  targetError.value = "";
  editing.value = true;
}
async function saveTarget(): Promise<void> {
  const value = Number(minutes.value);
  if (!isValidTimerDuration(value)) {
    targetError.value = TIMER_DURATION_MESSAGE;
    return;
  }
  if (await controller.setTarget(value, editingId.value)) editing.value = false;
}
async function replace(): Promise<void> {
  const choice = switching.value;
  if (choice) await controller.start(choice.target, choice.previousId);
}
async function complete(): Promise<void> {
  const target = timer.value;
  if (!target || completing.value || busy.value) return;
  completing.value = true;
  try {
    await writeDone(
      { kind: target.kind, id: target.targetId, title: target.title },
      true,
    );
    notifyDataChanged();
    await controller.refresh();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Erledigung fehlgeschlagen.";
  } finally {
    completing.value = false;
  }
}
/* The phone's menu: the same steps as the round buttons beside the time. */
const moreActions = computed<MenuEntry[]>(() => {
  const current = timer.value;
  if (!current) return [];
  return [
    {
      id: "target",
      label: "Soll ändern",
      icon: "edit",
      disabled: busy.value,
      run: openTarget,
    },
    {
      id: "complete",
      label: "Erledigen",
      icon: "check",
      ariaLabel: `${current.title} erledigen`,
      disabled: busy.value || completing.value,
      run: () => void complete(),
    },
    {
      id: "stop",
      label: "Beenden",
      icon: "stop",
      ariaLabel: "Stoppuhr beenden",
      disabled: busy.value || completing.value,
      run: () => void controller.action("stop"),
    },
  ];
});
/*
 * Each server resource reads on its own terms while signed in: changes from
 * the person's other apps as they happen, the stopwatch, the milestone
 * readings ahead of the next tick, and the Fokus-Sperre, which follows
 * what the server confirmed, not what a press shows ahead of its answer.
 */
let stops: (() => void)[] = [];
onMounted(() => {
  stops = [
    startLiveSync(),
    controller.startSync(),
    startMilestonePriming(),
    focusBlock.startSync(controller.confirmed),
  ];
});
onUnmounted(() => {
  for (const stop of stops) stop();
  document.documentElement.style.removeProperty(HEIGHT_PROPERTY);
  controller.dispose();
  focusBlock.dispose();
  stopOpenFocus?.();
});
</script>
<template>
  <aside
    v-if="(timer || error) && !hideBar"
    ref="bar"
    class="timer-bar"
    aria-label="Aktuelle Stoppuhr"
    :data-sticky-top="docked ? undefined : ''"
    :data-docked="docked ? '' : undefined"
  >
    <div v-if="timer" class="timer-bar__row" @click="openFocusFromBar">
      <!-- The words lead to the Fokus-Modus for keyboards and screen readers;
           a tap anywhere on the bar but its buttons does the same. -->
      <a
        class="timer-bar__text"
        :href="hrefOf('focus')"
        :aria-label="`${timer.title}: Fokus-Modus öffnen`"
      >
        <small>{{
          timer.state === "paused"
            ? "Pausiert"
            : reached
              ? "Soll erreicht"
              : "Stoppuhr läuft"
        }}</small><strong>{{ timer.title }}</strong>
      </a>
      <span class="timer-bar__time">
        <span aria-label="Gearbeitete Zeit">{{ display }}</span>
        <small v-if="timer.targetMinutes !== null" class="timer-bar__target">
          von {{ timer.targetMinutes }} Min.
        </small>
      </span>
      <div class="timer-bar__controls">
        <TimerIconButton
          v-if="timer.state === 'running'"
          icon="pause"
          label="Stoppuhr pausieren"
          :disabled="busy"
          @click="controller.action('pause')"
        />
        <TimerIconButton
          v-if="timer.state === 'paused'"
          icon="play"
          label="Stoppuhr fortsetzen"
          :disabled="busy"
          @click="controller.action('resume')"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="edit"
          label="Soll ändern"
          :disabled="busy"
          @click="openTarget"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="check"
          :label="`${timer.title} erledigen`"
          :disabled="busy || completing"
          @click="complete"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="stop"
          label="Stoppuhr beenden"
          :disabled="busy || completing"
          @click="controller.action('stop')"
        />
        <span class="timer-bar__more">
          <ActionMenu
            :title="timer.title"
            :entries="moreActions"
            label="Weitere Aktionen der Stoppuhr"
          />
        </span>
      </div>
    </div>
    <p v-if="error" role="alert" class="timer-bar__error">
      {{ error }}
      <button type="button" @click="controller.refresh()">
        Erneut synchronisieren
      </button>
    </p>
    <p v-if="timer && reached" class="timer-bar__hint" role="status">
      Soll erreicht. Die Stoppuhr läuft weiter, bis du pausierst oder beendest.
    </p>
    <FocusBlockSetupHint v-if="timer && focusBlock.block.value" where="bar" />
  </aside>
  <slot />
  <NoticeToast :message="notice.message.value" @close="notice.dismiss" />
  <ModalDialog
    v-if="switching"
    title="Andere Stoppuhr starten?"
    :busy="busy"
    focus-selector="[data-confirm-switch]"
    @close="switching = null"
  >
    <p>
      Die bisherige Stoppuhr beenden und „{{ switching.target.title }}“ starten?
      Die bisher gearbeitete Zeit bleibt im Logbuch, die Quest bleibt offen.
    </p>
    <div class="timer-dialog-actions">
      <button data-confirm-switch type="button" @click="replace">
        Stoppuhr wechseln</button
      ><button type="button" @click="switching = null">Abbrechen</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </ModalDialog>
  <ModalDialog
    v-if="editing"
    title="Soll ändern"
    :busy="busy"
    focus-selector='[name="timerMinutes"]'
    @close="editing = false"
  >
    <form novalidate @submit.prevent="saveTarget">
      <label for="timer-minutes">Geplante Minuten</label
      ><input
        id="timer-minutes"
        v-model="minutes"
        name="timerMinutes"
        type="number"
        min="1"
        :max="TIMER_MAX_MINUTES"
        step="1"
        :disabled="busy"
      />
      <p>
        Die gearbeitete Zeit bleibt, wie sie ist. Gespeichert
        {{
          timer?.kind === "todo"
            ? "an der Quest"
            : "nur an dieser Daily-Ausführung, nicht am gesamten Daily"
        }}.
      </p>
      <div class="timer-dialog-actions">
        <button type="submit" :disabled="busy">Soll speichern</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Abbrechen
        </button>
      </div>
      <p v-if="targetError || error" role="alert">
        {{ targetError || error }}
      </p>
    </form>
  </ModalDialog>
</template>
<style scoped>
/*
 * Docked on the tab bar at the bottom: a floating card one gap above it,
 * as wide as the page column. The gap is its bottom margin, which the
 * published height includes. Under the scrim of "Mehr", over the page.
 */
.timer-bar {
  position: fixed;
  right: 0;
  bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px));
  left: 0;
  z-index: 22;
  width: min(
    100% - 1rem - env(safe-area-inset-left, 0px) -
      env(safe-area-inset-right, 0px),
    var(--page-width)
  );
  margin: 0 auto var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
}
/* Wide screens and mouse windows: a card that sticks below the top bar. */
@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  .timer-bar {
    position: sticky;
    top: calc(3.5rem + 0.5rem);
    right: auto;
    bottom: auto;
    left: auto;
    z-index: 20;
    width: min(100% - 2rem, var(--page-width));
    margin: 1rem auto 0;
    padding: var(--space-4);
    box-shadow: var(--shadow-card);
  }
}
.timer-bar__row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--space-2);
}
@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  .timer-bar__row {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}
.timer-bar__text {
  display: grid;
  flex: 1;
  min-width: 8rem;
  overflow-wrap: anywhere;
  color: inherit;
  text-decoration: none;
}
@media (hover: hover) {
  .timer-bar__text:hover strong {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
}
/* The whole bar leads to the Fokus-Modus, apart from its buttons. */
.timer-bar__row {
  cursor: pointer;
}
.timer-bar__controls {
  cursor: default;
}
.timer-bar__text small {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
.timer-bar__text strong {
  font-size: 1rem;
}
.timer-bar__time {
  display: grid;
  justify-items: end;
  font-size: 1.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--color-ink);
}
.timer-bar__target {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
}
.timer-bar__controls {
  display: flex;
  gap: 0.5rem;
}
.timer-bar__error {
  color: var(--color-danger);
  margin: 0.5rem 0 0;
}
.timer-bar__hint {
  color: var(--color-ink-muted);
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
}
.timer-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
.timer-dialog-actions button,
.timer-bar__error button {
  min-height: var(--tap);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  font-weight: 700;
  padding: 0 var(--space-4);
  font: inherit;
  cursor: pointer;
}
input {
  width: 100%;
  margin-top: 0.5rem;
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
}
.timer-bar__more {
  display: none;
}
/*
 * A phone keeps the bar to one line: state and title (cut with an ellipsis),
 * the time, pause or resume, and the menu with the rarer steps.
 */
@media (hover: hover) and (pointer: fine) and (max-width: 39.99rem) {
  .timer-bar {
    width: calc(100% - 1rem);
    margin-top: 0.5rem;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  }
}
@media (max-width: 39.99rem) {
  .timer-bar__row {
    flex-wrap: nowrap;
    gap: var(--space-2);
  }
  .timer-bar__text {
    min-width: 0;
    overflow-wrap: normal;
  }
  .timer-bar__text small,
  .timer-bar__text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timer-bar__text small {
    font-size: 0.8125rem;
    line-height: 1.3;
  }
  .timer-bar__text strong {
    line-height: 1.3;
  }
  .timer-bar__time {
    font-size: 1.25rem;
  }
  .timer-bar__target {
    font-size: 0.75rem;
  }
  .timer-bar__controls {
    gap: 0;
    margin-left: auto;
  }
  .timer-bar__wide {
    display: none;
  }
  .timer-bar__more {
    display: contents;
  }
  /* Still announced; the state above the title says it in one word. */
  .timer-bar__hint {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
