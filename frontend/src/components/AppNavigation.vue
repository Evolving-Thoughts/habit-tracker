<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import KeyCombo from "./KeyCombo.vue";
import { isMac, overlay, useKeyboardLikely } from "../composables/useShortcuts";
import { VIEWS } from "../router";
import { ariaKeys, keyCaps, shortcutById } from "../utils/shortcuts";

/**
 * The views as tabs: at the bottom on a phone, at the top from 56rem. "Mehr"
 * is a disclosure: a button that shows or hides a list of links, walked with
 * Tab. On a phone it holds the rarer views. From 56rem Plan has its own tab;
 * from 70rem Wochenrückblick, Fokus and Dailies too, so Mehr keeps only
 * Kategorien and Einstellungen; from 82rem nothing, so the button goes and
 * every view is a labelled tab.
 */
const route = useRoute();
const keyboardLikely = useKeyboardLikely();

/*
 * Wide screens show some Mehr views as tabs, so those render in both places.
 * The "wider" ones form the group on the right, after the main views.
 */
const PRIMARY = [
  ...VIEWS.filter((view) => view.primary || view.tabFrom === "wide"),
  ...VIEWS.filter((view) => view.tabFrom === "wider"),
];
const SECONDARY = VIEWS.filter((view) => !view.primary);

const open = ref(false);
const more = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
/*
 * One of its views is open: Mehr is the current tab, as long as that view
 * has no tab of its own at this width. Which width that is, CSS decides.
 */
const openFrom = (tabFrom: "wide" | "wider" | undefined) =>
  computed(() =>
    SECONDARY.some(
      (view) => view.tabFrom === tabFrom && view.name === route.name,
    ),
  );
const activeWide = openFrom(undefined);
const activeMedium = openFrom("wider");
const activeNarrow = openFrom("wide");

const menuShortcut = shortcutById("menu.open");

function close(returnFocus = false): void {
  if (!open.value) return;
  open.value = false;
  if (returnFocus) button.value?.focus();
}
watch(
  () => route.name,
  () => close(),
);

/* Leaving the menu by Tab or by a click elsewhere closes it. */
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  if (next instanceof Node && !more.value?.contains(next)) close();
}
function onPointerDown(event: PointerEvent): void {
  if (event.target instanceof Node && !more.value?.contains(event.target))
    close();
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && open.value && !event.defaultPrevented)
    close(true);
}
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onPointerDown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("pointerdown", onPointerDown);
});
</script>

<template>
  <nav class="tab-bar" aria-label="Ansichten">
    <div class="tab-bar__inner">
      <RouterLink
        v-for="view in PRIMARY"
        :key="view.name"
        :to="{ name: view.name }"
        class="tab-bar__tab"
        :class="{
          'tab-bar__tab--wide': view.tabFrom === 'wide',
          'tab-bar__tab--wider': view.tabFrom === 'wider',
        }"
      >
        <AppIcon :name="view.name" />
        <span>{{ view.label }}</span>
      </RouterLink>
      <div ref="more" class="tab-bar__more-group" @focusout="onFocusOut">
        <button
          ref="button"
          type="button"
          class="tab-bar__tab tab-bar__more"
          :aria-expanded="open"
          aria-controls="more-views"
          :data-active="activeWide || undefined"
          :data-active-medium="activeMedium || undefined"
          :data-active-narrow="activeNarrow || undefined"
          @click="open = !open"
        >
          <AppIcon name="more" />
          <span>Mehr</span>
          <AppIcon name="chevron-down" class="tab-bar__caret" />
        </button>
        <div
          id="more-views"
          class="tab-bar__secondary"
          :data-open="open || undefined"
        >
          <RouterLink
            v-for="view in SECONDARY"
            :key="view.name"
            :to="{ name: view.name }"
            class="tab-bar__tab"
            :class="{
              'tab-bar__tab--narrow': view.tabFrom === 'wide',
              'tab-bar__tab--below-wider': view.tabFrom === 'wider',
            }"
          >
            <AppIcon :name="view.name" />
            <span>{{ view.label }}</span>
          </RouterLink>
        </div>
      </div>
      <button
        type="button"
        class="tab-bar__tab tab-bar__command"
        :aria-keyshortcuts="ariaKeys(menuShortcut, isMac)"
        :title="`Befehle (${keyCaps(menuShortcut, isMac).join('+')})`"
        @click="overlay = 'menu'"
      >
        <AppIcon name="search" />
        <span class="tab-bar__command-label">Befehle</span>
        <KeyCombo
          v-if="keyboardLikely"
          :shortcut="menuShortcut"
          class="tab-bar__keys"
          aria-hidden="true"
        />
      </button>
    </div>
  </nav>
  <div v-if="open" class="tab-bar__scrim" aria-hidden="true" @click="close()" />
</template>

<style scoped>
.tab-bar {
  position: fixed;
  inset: auto 0 0;
  z-index: 30;
  padding: 0 var(--space-1) env(safe-area-inset-bottom, 0px);
  background: var(--color-surface);
  box-shadow: var(--shadow-bar);
}

.tab-bar__inner {
  position: relative;
  display: flex;
  max-width: var(--page-width);
  margin: 0 auto;
}

.tab-bar__tab {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 0.2rem;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--tab-bar-height);
  /* Narrow side padding: "Kampagnen" fits a fifth of a 360px phone uncut. */
  padding: var(--space-2) 0.0625rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.tab-bar__tab > span:not(.tab-bar__keys) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bar__tab:active {
  transform: var(--press);
}

.tab-bar__tab[aria-current="page"],
.tab-bar__more[data-active],
.tab-bar__more[data-active-medium],
.tab-bar__more[data-active-narrow] {
  color: var(--color-action);
}

.tab-bar__tab[aria-current="page"] :deep(svg),
.tab-bar__more[data-active] :deep(svg),
.tab-bar__more[data-active-medium] :deep(svg),
.tab-bar__more[data-active-narrow] :deep(svg) {
  stroke-width: 2.4;
}

/* On a phone the group is just the last tab; its list pops up above. */
.tab-bar__more-group {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
}

.tab-bar__more .tab-bar__caret,
.tab-bar__command {
  display: none;
}

.tab-bar__secondary {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  display: none;
  flex-direction: column;
  min-width: 14rem;
  padding: var(--space-2);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
}

.tab-bar__secondary[data-open] {
  display: flex;
}

.tab-bar__secondary .tab-bar__tab {
  flex: none;
  flex-direction: row;
  gap: var(--space-3);
  justify-content: flex-start;
  min-height: var(--tap-large);
  padding: 0 var(--space-4);
  font-size: 1rem;
  letter-spacing: normal;
}

.tab-bar__scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: var(--color-scrim-light);
}

.tab-bar__tab--wide,
.tab-bar__tab--wider {
  display: none;
}

/* Wide screens: the bar moves to the top and every main view is a tab. */
@media (min-width: 56rem) {
  .tab-bar {
    inset: 0 0 auto;
    padding: 0 var(--space-4);
    box-shadow: 0 1px 0 var(--color-line);
  }

  .tab-bar__inner {
    max-width: 64rem;
    gap: var(--space-1);
  }

  .tab-bar__tab {
    flex: 0 0 auto;
    flex-direction: row;
    gap: var(--space-2);
    min-height: 3.5rem;
    padding: 0 var(--space-3);
    font-size: 0.9375rem;
    letter-spacing: normal;
  }

  .tab-bar__tab--wide {
    display: flex;
  }

  .tab-bar__tab--narrow {
    display: none;
  }

  /* Plan has its own tab here, so it no longer makes "Mehr" current. */
  .tab-bar__more[data-active-narrow] {
    color: var(--color-ink-muted);
  }

  .tab-bar__more[data-active-narrow] :deep(svg) {
    stroke-width: 2;
  }

  .tab-bar__more-group {
    flex: none;
    margin-left: auto;
  }

  .tab-bar__more .tab-bar__caret {
    display: block;
    width: 1rem;
    height: 1rem;
    margin-left: calc(var(--space-1) * -1);
    transition: transform 200ms var(--ease-out);
  }

  .tab-bar__more[aria-expanded="true"] .tab-bar__caret {
    transform: rotate(180deg);
  }

  /* Below 82rem "Mehr" drops its list below the bar. */
  .tab-bar__secondary {
    top: calc(100% + var(--space-1));
    bottom: auto;
  }

  /* A click outside closes the menu; the dimmed scrim is the phone's. */
  .tab-bar__scrim {
    display: none;
  }

  .tab-bar__command {
    display: flex;
  }

  .tab-bar__keys {
    display: none;
    margin-left: var(--space-1);
  }
}

/* The key caps of Ctrl+K fit beside "Befehle" once the bar has room. */
@media (min-width: 64rem) and (max-width: 69.99rem) {
  .tab-bar__keys {
    display: inline-flex;
  }
}

/*
 * From 70rem, a usual desktop window, Wochenrückblick, Fokus and Dailies
 * get their labelled tabs on the right; Mehr keeps the two settings views.
 * The tabs sit a little tighter, the type stays the same size.
 */
@media (min-width: 70rem) {
  .tab-bar__inner {
    max-width: 80rem;
  }

  .tab-bar__inner > .tab-bar__tab {
    gap: 0.375rem;
    padding: 0 0.625rem;
  }

  .tab-bar__tab--wider {
    display: flex;
  }

  /* The first of them starts the group on the right; Mehr follows it. */
  .tab-bar__tab--wider:not(.tab-bar__tab--wider ~ .tab-bar__tab--wider) {
    margin-left: auto;
  }

  .tab-bar__more-group {
    margin-left: 0;
  }

  .tab-bar__tab--below-wider {
    display: none;
  }

  .tab-bar__more[data-active-medium] {
    color: var(--color-ink-muted);
  }

  .tab-bar__more[data-active-medium] :deep(svg) {
    stroke-width: 2;
  }

  /*
   * The command button keeps only its magnifier here; its name stays for
   * screen readers and in the tooltip, with the shortcut.
   */
  .tab-bar__inner > .tab-bar__command {
    justify-content: center;
    width: var(--tap);
    padding: 0;
  }

  .tab-bar__command .tab-bar__command-label,
  .tab-bar__command .tab-bar__keys {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

/*
 * From 82rem there is room for every view with its name, so "Mehr" goes and
 * its views stand in the bar as tabs.
 */
@media (min-width: 82rem) {
  .tab-bar__more-group {
    display: contents;
  }

  .tab-bar__more {
    display: none;
  }

  .tab-bar__secondary,
  .tab-bar__secondary[data-open] {
    position: static;
    display: flex;
    flex-direction: row;
    gap: var(--space-1);
    min-width: 0;
    padding: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
  }

  /* Inline, the settings views are tabs like the rest. */
  .tab-bar__secondary .tab-bar__tab {
    gap: 0.375rem;
    min-height: 3.5rem;
    padding: 0 0.625rem;
    font-size: 0.9375rem;
  }
}
</style>
