<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
  useId,
  watch,
} from "vue";
import AppIcon from "./AppIcon.vue";
import KeyCombo from "./KeyCombo.vue";
import {
  isMac,
  singleKeys,
  useKeyboardLikely,
} from "../composables/useShortcuts";
import { useOverlay } from "../composables/useOverlayStack";
import { ariaKeys, SHORTCUTS } from "../utils/shortcuts";
import type { MenuEntry } from "../utils/row-actions";

/**
 * The one menu "Aktionen für …" behind a row's "…" button. Below 40rem it
 * is a sheet from the bottom, from 40rem a popover at the button. It lives
 * at the end of the page (Teleport), so a scrolling board or a row's own
 * containment cannot cut it off.
 */
const props = withDefaults(
  defineProps<{
    /** The item's title: the menu's heading and part of the button's name. */
    title: string;
    entries: MenuEntry[];
    disabled?: boolean;
    /** Spoken name of the button; "Aktionen für <title>" by default. */
    label?: string;
    /** Marks the button, so a view can find it again (data-menu-trigger). */
    triggerKey?: string | number;
  }>(),
  { disabled: false, label: undefined, triggerKey: undefined },
);

const id = useId();
const menuId = computed(() => `action-menu-${id}`);
const titleId = computed(() => `action-menu-title-${id}`);
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const place = ref<{ top: number; left: number } | null>(null);
const keyboardLikely = useKeyboardLikely();

function shortcutOf(entry: MenuEntry) {
  if (!entry.shortcut || !singleKeys.value) return null;
  return SHORTCUTS.find((item) => item.id === entry.shortcut) ?? null;
}

function items(): HTMLElement[] {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      "[role=menuitem]:not(:disabled)",
    ) ?? [],
  );
}

const wide = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(min-width: 40rem)").matches;

/** Space the popover keeps from the window's edges. */
const EDGE = 8;

/**
 * From 40rem the popover hangs below the button, or above it near the
 * bottom. Where it fits on neither side, it moves up just as far as it
 * must to stay whole in the window, over its button if need be; it is never
 * taller than the window (CSS), so every entry stays in reach.
 */
function position(): void {
  const button = trigger.value;
  const menu = panel.value;
  if (!button || !menu || !wide()) {
    place.value = null;
    return;
  }
  const rect = button.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const gap = 4;
  const below = rect.bottom + gap;
  const above = rect.top - gap - height;
  const top =
    below + height <= window.innerHeight - EDGE
      ? below
      : above >= EDGE
        ? above
        : Math.max(EDGE, window.innerHeight - EDGE - height);
  const left = Math.min(
    Math.max(EDGE, rect.right - width),
    window.innerWidth - width - EDGE,
  );
  place.value = { top, left };
}

async function show(): Promise<void> {
  open.value = true;
  await nextTick();
  position();
  // Measured and placed first: a hidden popover cannot take the focus.
  await nextTick();
  items()[0]?.focus();
}

function close({ restoreFocus = true } = {}): void {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}

// Back on the phone closes the open menu, as Escape does.
useOverlay(open, () => close());

function toggle(): void {
  if (open.value) close();
  else void show();
}

/** The focus goes back to the button first, so a dialog the entry opens returns it there. */
function choose(entry: MenuEntry): void {
  if (entry.disabled) return;
  close();
  entry.run();
}

function onKeydown(event: KeyboardEvent): void {
  const list = items();
  if (!list.length) return;
  const index = list.indexOf(document.activeElement as HTMLElement);
  if (event.key === "ArrowDown") list[(index + 1) % list.length]?.focus();
  else if (event.key === "ArrowUp")
    list[(index - 1 + list.length) % list.length]?.focus();
  else if (event.key === "Home") list[0]?.focus();
  else if (event.key === "End") list[list.length - 1]?.focus();
  else if (event.key === "Tab") {
    // The menu sits at the end of the page; Tab carries on from the button.
    event.preventDefault();
    close();
    return;
  } else return;
  event.preventDefault();
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
}

function onViewportChange(): void {
  if (open.value) position();
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener("keydown", onWindowKeydown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, {
      capture: true,
      passive: true,
    });
  } else {
    window.removeEventListener("keydown", onWindowKeydown);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, { capture: true });
  }
});

// A busy row closes its menu; the entries would not run anyway.
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close({ restoreFocus: false });
  },
);

// Heute hidden behind another view (KeepAlive) takes its open menu along.
onDeactivated(() => close({ restoreFocus: false }));

onBeforeUnmount(() => {
  open.value = false;
  window.removeEventListener("keydown", onWindowKeydown);
  window.removeEventListener("resize", onViewportChange);
  window.removeEventListener("scroll", onViewportChange, { capture: true });
});

defineExpose({ close });
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="btn btn--quiet btn--icon action-menu__trigger"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="menuId"
    :aria-label="label ?? `Aktionen für ${title}`"
    :title="label ?? `Aktionen für ${title}`"
    :data-menu-trigger="triggerKey"
    :disabled="disabled"
    @click="toggle"
  >
    <AppIcon name="more" />
  </button>
  <Teleport to="body">
    <template v-if="open">
      <div class="action-menu__scrim" aria-hidden="true" @click="close()" />
      <div
        ref="panel"
        class="action-menu"
        :style="
          place ? { top: `${place.top}px`, left: `${place.left}px` } : undefined
        "
        :data-placed="place ? '' : undefined"
      >
        <p :id="titleId" class="action-menu__title">{{ title }}</p>
        <div
          :id="menuId"
          class="action-menu__list"
          role="menu"
          :aria-labelledby="titleId"
          @keydown="onKeydown"
        >
          <button
            v-for="entry in entries"
            :key="entry.id"
            type="button"
            role="menuitem"
            class="btn btn--quiet action-menu__item"
            :class="{ 'action-menu__item--last': entry.last }"
            :disabled="entry.disabled"
            :aria-label="entry.ariaLabel"
            :aria-keyshortcuts="
              shortcutOf(entry)
                ? ariaKeys(shortcutOf(entry)!, isMac)
                : undefined
            "
            :data-entry="entry.id"
            @click="choose(entry)"
          >
            <AppIcon :name="entry.icon" />
            <span class="action-menu__label">{{ entry.label }}</span>
            <KeyCombo
              v-if="keyboardLikely && shortcutOf(entry)"
              class="action-menu__keys"
              :shortcut="shortcutOf(entry)!"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style scoped>
.action-menu__trigger {
  flex: none;
}

.action-menu__trigger[aria-expanded="true"] {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.action-menu__scrim {
  position: fixed;
  inset: 0;
  z-index: 35;
}

/* A sheet from the bottom on a phone, a popover at the button from 40rem. */
.action-menu {
  position: fixed;
  inset: auto 0 0;
  z-index: 40;
  display: grid;
  gap: var(--space-1);
  /* Never taller than the window: a long menu scrolls inside itself. */
  max-height: calc(100dvh - var(--space-6));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-3) var(--space-3)
    calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
}

@media (max-width: 39.99rem) {
  .action-menu__scrim {
    background: var(--color-scrim-light);
  }
}

@media (min-width: 40rem) {
  .action-menu {
    inset: auto;
    min-width: 15rem;
    max-width: min(22rem, calc(100vw - 1rem));
    /* Twice the edge it keeps (EDGE in position()). */
    max-height: calc(100dvh - 1rem);
    padding: var(--space-2);
    border-radius: var(--radius-card);
  }

  /* Until it is measured it stays out of sight, so it never flashes elsewhere. */
  .action-menu:not([data-placed]) {
    top: 0;
    left: 0;
    visibility: hidden;
  }
}

.action-menu__title {
  margin: 0;
  padding: var(--space-1) var(--space-3) var(--space-2);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.action-menu__list {
  display: grid;
  gap: var(--space-1);
}

.action-menu__item {
  justify-content: flex-start;
  width: 100%;
  color: var(--color-ink);
  text-align: left;
}

.action-menu__item:disabled {
  color: var(--color-ink-soft);
}

.action-menu__label {
  flex: 1;
}

.action-menu__keys {
  margin-left: auto;
}

/* The last entry (Löschen) stands apart, still in ink. */
.action-menu__item--last {
  position: relative;
  margin-top: var(--space-2);
}

.action-menu__item--last::before {
  position: absolute;
  top: calc(-1 * var(--space-1) - 1px);
  right: var(--space-2);
  left: var(--space-2);
  height: 1px;
  background: var(--color-line);
  content: "";
}
</style>
