<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { isMac, overlay } from "../composables/useShortcuts";
import { VIEWS } from "../router";
import { ariaKeys, keyCaps, shortcutById } from "../utils/shortcuts";

/**
 * The views as tabs: at the bottom on a phone, at the top from 56rem or
 * with a mouse.
 *
 * On a phone four views are tabs and "Mehr", a disclosure (a button that
 * shows or hides a list of links, walked with Tab), holds the rest. From
 * 56rem every view is a labelled tab, in groups by intent, and the bar ends
 * on the right with the command button and Einstellungen, both as icons.
 * Below 75rem the tabs leave out their icons, so the names fit.
 */
const route = useRoute();

/* Einstellungen is the gear at the end of the wide bar, not a named tab. */
const TABS = VIEWS.filter((view) => view.name !== "settings");
const SETTINGS = VIEWS.find((view) => view.name === "settings")!;
/* What "Mehr" holds on a phone. */
const SECONDARY = VIEWS.filter((view) => !view.primary);

const open = ref(false);
const more = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
/* One of its views is open: Mehr is the current tab. */
const moreActive = computed(() =>
  SECONDARY.some((view) => view.name === route.name),
);

const menuShortcut = shortcutById("menu.open");
const settingsShortcut = shortcutById("view.settings");
const tooltip = (name: string, shortcut: typeof menuShortcut) =>
  `${name} (${keyCaps(shortcut, isMac).join("+")})`;

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
        v-for="view in TABS"
        :key="view.name"
        :to="{ name: view.name }"
        class="tab-bar__tab tab-bar__view"
        :class="{
          'tab-bar__view--secondary': !view.primary,
          'tab-bar__view--group': view.groupStart,
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
          :data-active="moreActive || undefined"
          @click="open = !open"
        >
          <AppIcon name="more" />
          <span>Mehr</span>
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
          >
            <AppIcon :name="view.name" />
            <span>{{ view.label }}</span>
          </RouterLink>
        </div>
      </div>
      <!-- Icons only: the names stay for screen readers and in the tooltip. -->
      <button
        type="button"
        class="tab-bar__tab tab-bar__icon tab-bar__command"
        :aria-keyshortcuts="ariaKeys(menuShortcut, isMac)"
        :title="tooltip('Befehle', menuShortcut)"
        @click="overlay = 'menu'"
      >
        <AppIcon name="search" />
        <span class="visually-hidden">Befehle</span>
      </button>
      <RouterLink
        :to="{ name: SETTINGS.name }"
        class="tab-bar__tab tab-bar__icon tab-bar__settings"
        :aria-keyshortcuts="ariaKeys(settingsShortcut, isMac)"
        :title="tooltip(SETTINGS.label, settingsShortcut)"
      >
        <AppIcon :name="SETTINGS.name" />
        <span class="visually-hidden">{{ SETTINGS.label }}</span>
      </RouterLink>
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

.tab-bar__tab > span:not(.visually-hidden) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bar__tab:active {
  transform: var(--press);
}

.tab-bar__tab[aria-current="page"],
.tab-bar__more[data-active] {
  color: var(--color-action);
}

.tab-bar__tab[aria-current="page"] :deep(svg),
.tab-bar__more[data-active] :deep(svg) {
  stroke-width: 2.4;
}

/* On a phone the views behind Mehr are no tabs of their own. */
.tab-bar__view--secondary,
.tab-bar__icon {
  display: none;
}

/* On a phone the group is just the last tab; its list pops up above. */
.tab-bar__more-group {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
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

/*
 * Wide screens, and any window used with a mouse: the bar moves to the
 * top and every view is a labelled tab.
 * The nine names with the command button and the gear take about 52rem
 * with the narrow padding of this tier (measured in Nunito 700: 835px,
 * against 54rem free at 56rem less a scrollbar); with an icon in each tab
 * and the full padding about 71.5rem, so the icons join at 75rem.
 */
@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  .tab-bar {
    inset: 0 0 auto;
    padding: 0 var(--space-4);
    box-shadow: 0 1px 0 var(--color-line);
  }

  .tab-bar__inner {
    max-width: 80rem;
    overflow-x: auto;
    scrollbar-width: thin;
    gap: var(--space-1);
  }

  .tab-bar__tab {
    flex: 0 0 auto;
    flex-direction: row;
    gap: 0.375rem;
    min-width: var(--tap);
    min-height: 3.5rem;
    /* Names only: a narrower padding, so nine of them fit from 56rem. */
    padding: 0 0.375rem;
    font-size: 0.9375rem;
    letter-spacing: normal;
  }

  .tab-bar__view--secondary {
    display: flex;
  }

  .tab-bar__view :deep(svg) {
    display: none;
  }

  /* A new group by intent: a little more space before it, no line. */
  .tab-bar__view--group {
    margin-left: var(--space-3);
  }

  .tab-bar__more-group,
  .tab-bar__scrim {
    display: none;
  }

  /* Magnifier and gear in tap size at the far right. */
  .tab-bar__icon {
    display: flex;
    justify-content: center;
    width: var(--tap);
    padding: 0;
  }

  .tab-bar__command {
    margin-left: auto;
  }
}

@media (min-width: 75rem) {
  .tab-bar__tab {
    padding: 0 var(--space-2);
  }

  .tab-bar__icon {
    padding: 0;
  }

  .tab-bar__view :deep(svg) {
    display: block;
  }
}
</style>
