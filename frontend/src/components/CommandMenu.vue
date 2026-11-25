<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { search } from "../api/search.api";
import CampaignChip from "./CampaignChip.vue";
import KeyCombo from "./KeyCombo.vue";
import ModalDialog from "./ModalDialog.vue";
import SearchHighlight from "./SearchHighlight.vue";
import { singleKeys, useKeyboardLikely } from "../composables/useShortcuts";
import type { SearchResponse } from "../types/search";
import { filterCommands, type Command } from "../utils/command-filter";
import {
  textRows,
  titleRows,
  type SearchAction,
  type SearchRow,
} from "../utils/search-entries";
import { isSingleKey, shortcutById } from "../utils/shortcuts";

/**
 * Ctrl+K: every view and the common actions in one searchable list, and
 * from two characters on also the titles and texts the server finds. The
 * field is a combobox; arrow keys move through the options, Enter runs one.
 */
const props = defineProps<{
  commands: readonly Command[];
  /** Opened to type (Suchen): the field takes the keyboard on touch too. */
  openKeyboard?: boolean;
}>();
const emit = defineEmits<{
  run: [command: Command];
  open: [action: SearchAction];
  close: [];
}>();

/** The server is asked from this many characters on, after a short pause. */
const SEARCH_MIN = 2;
const SEARCH_DELAY_MS = 200;
const SCOPE = "Sucht in Ansichten, Befehlen, Titeln und Notizen.";

const keyboardLikely = useKeyboardLikely();
const query = ref("");
const trimmed = computed(() => query.value.trim().replace(/\s+/g, " "));
const list = ref<HTMLElement | null>(null);

/* The server's answer for `found.query`; kept while the next one loads. */
const found = ref<SearchResponse | null>(null);
const searching = ref(false);
const searchFailed = ref(false);
let pending: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | null = null;

function cancelSearch(): void {
  clearTimeout(pending);
  controller?.abort();
  controller = null;
}

watch(trimmed, (text) => {
  cancelSearch();
  searchFailed.value = false;
  if (text.length < SEARCH_MIN) {
    found.value = null;
    searching.value = false;
    return;
  }
  // The last answer stays while the next loads, if the two searches overlap.
  const last = found.value?.query.toLowerCase() ?? "";
  const next = text.toLowerCase();
  if (!next.startsWith(last) && !last.startsWith(next)) found.value = null;
  searching.value = true;
  pending = setTimeout(async () => {
    const own = new AbortController();
    controller = own;
    // A newer search took over (or the menu closed): this answer is stale.
    try {
      const answer = await search(text, own.signal);
      if (controller !== own) return;
      found.value = answer;
    } catch {
      if (controller !== own) return;
      found.value = null;
      searchFailed.value = true;
    }
    controller = null;
    searching.value = false;
  }, SEARCH_DELAY_MS);
});
onBeforeUnmount(cancelSearch);

const results = computed(() => filterCommands(props.commands, query.value));

type Section =
  | { kind: "commands"; label: string | null; commands: Command[] }
  | { kind: "search"; label: string; rows: SearchRow[] };

/** Grouped while nothing is typed; a search adds what the server found. */
const sections = computed<Section[]>(() => {
  if (!trimmed.value)
    return (["Ansichten", "Aktionen"] as const)
      .map((group) => ({
        kind: "commands" as const,
        label: group,
        commands: results.value.filter((command) => command.group === group),
      }))
      .filter((section) => section.commands.length);
  const answer = found.value;
  // The commands get a heading once found entries stand below them.
  const anyFound = !!answer && answer.titles.length + answer.texts.length > 0;
  const shown: Section[] = [
    {
      kind: "commands",
      label: anyFound ? "Ansichten und Aktionen" : null,
      commands: results.value,
    },
    {
      kind: "search",
      label: "Kampagnen, Quests und Dailies",
      rows: answer ? titleRows(answer.titles) : [],
    },
    {
      kind: "search",
      label: "In Notizen und Texten",
      rows: answer ? textRows(answer.texts) : [],
    },
  ];
  return shown.filter((section) =>
    section.kind === "commands" ? section.commands.length : section.rows.length,
  );
});

type Entry = { id: string; pick: () => void };
const optionId = (command: Command) =>
  `command-${command.id.replace(/\W/g, "-")}`;

/** Every option in the order it is shown, side actions after their row. */
const entries = computed<Entry[]>(() =>
  sections.value.flatMap((section) =>
    section.kind === "commands"
      ? section.commands.map((command) => ({
          id: optionId(command),
          pick: () => emit("run", command),
        }))
      : section.rows.flatMap((row) =>
          row.options.map((option) => ({
            id: option.id,
            pick: () => emit("open", option.action),
          })),
        ),
  ),
);

/* The active option by id, so arriving results do not move it. */
const activeId = ref<string | null>(null);
const active = computed(
  () =>
    entries.value.find((entry) => entry.id === activeId.value) ??
    entries.value[0] ??
    null,
);
watch(query, () => (activeId.value = null));
watch(
  () => active.value?.id,
  async (id) => {
    await nextTick();
    if (id)
      list.value
        ?.querySelector<HTMLElement>(`#${id}`)
        ?.scrollIntoView?.({ block: "nearest" });
  },
);

/**
 * Shown only where it works: where a keyboard is likely (a fine pointer, or
 * a key that already reached a shortcut; never from a touch screen alone),
 * and single keys switched off show no key.
 */
function caps(command: Command) {
  if (!keyboardLikely.value || !command.shortcut) return null;
  const shortcut = shortcutById(command.shortcut);
  if (isSingleKey(shortcut) && !singleKeys.value) return null;
  return shortcut;
}

function move(to: number): void {
  const count = entries.value.length;
  if (!count) return;
  activeId.value = entries.value[(to + count) % count]!.id;
}
const activeIndex = () =>
  active.value ? entries.value.indexOf(active.value) : -1;
function hover(id: string): void {
  activeId.value = id;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    emit("close");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    move(activeIndex() + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    move(activeIndex() - 1);
  } else if (event.key === "Home" && entries.value.length) {
    event.preventDefault();
    move(0);
  } else if (event.key === "End" && entries.value.length) {
    event.preventDefault();
    move(entries.value.length - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    active.value?.pick();
  }
}

const nothingFound = computed(
  () => !!trimmed.value && !entries.value.length && !searching.value,
);
/** The count of what is listed; with nothing yet, that the server is asked. */
const status = computed(() => {
  if (!trimmed.value) return "";
  const count = entries.value.length;
  if (!count && searching.value) return "Suche läuft …";
  if (!count) return `Nichts gefunden für „${trimmed.value}“.`;
  return count === 1 ? "1 Treffer" : `${count} Treffer`;
});
</script>

<template>
  <ModalDialog
    class="command-menu"
    title="Befehle"
    focus-selector=".command-menu__search"
    :open-keyboard="openKeyboard"
    @close="emit('close')"
  >
    <input
      v-model="query"
      class="input command-menu__search"
      type="text"
      role="combobox"
      aria-label="Ansichten, Befehle, Titel und Notizen durchsuchen"
      aria-autocomplete="list"
      :aria-expanded="entries.length > 0"
      aria-controls="command-menu-list"
      :aria-activedescendant="active?.id"
      :aria-describedby="trimmed ? undefined : 'command-menu-scope'"
      placeholder="Suchen …"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="go"
      @keydown="onKeydown"
    />
    <p v-if="!trimmed" id="command-menu-scope" class="command-menu__scope">
      {{ SCOPE }}
    </p>
    <div
      id="command-menu-list"
      ref="list"
      class="command-menu__list"
      role="listbox"
      aria-label="Befehle und Treffer"
    >
      <div
        v-for="section in sections"
        :key="section.label ?? 'results'"
        class="command-menu__group"
        :role="section.label ? 'group' : 'presentation'"
        :aria-label="section.label ?? undefined"
      >
        <p
          v-if="section.label"
          class="command-menu__heading"
          aria-hidden="true"
        >
          {{ section.label }}
        </p>
        <template v-if="section.kind === 'commands'">
          <div
            v-for="command in section.commands"
            :id="optionId(command)"
            :key="command.id"
            class="command-menu__option"
            role="option"
            :aria-selected="optionId(command) === active?.id"
            @pointermove="hover(optionId(command))"
            @click="emit('run', command)"
          >
            <span class="command-menu__label">{{ command.label }}</span>
            <KeyCombo
              v-if="caps(command)"
              :shortcut="caps(command)!"
              class="command-menu__keys"
            />
          </div>
        </template>
        <template v-else>
          <div
            v-for="row in section.rows"
            :key="row.key"
            class="command-menu__row"
            role="none"
          >
            <div
              :id="row.options[0]!.id"
              class="command-menu__option command-menu__option--hit"
              role="option"
              :aria-selected="row.options[0]!.id === active?.id"
              @pointermove="hover(row.options[0]!.id)"
              @click="emit('open', row.options[0]!.action)"
            >
              <span class="command-menu__hit">
                <template v-if="row.group === 'titles'">
                  <span class="command-menu__label">
                    <SearchHighlight
                      :text="row.hit.title"
                      :range="row.hit.highlight"
                    />
                  </span>
                  <span class="command-menu__meta">
                    <span>{{ row.meta }}</span>
                    <CampaignChip
                      v-if="row.hit.campaign && row.hit.kind !== 'campaign'"
                      :campaign="row.hit.campaign"
                    />
                  </span>
                </template>
                <template v-else>
                  <span class="command-menu__label">{{ row.hit.label }}</span>
                  <span class="command-menu__snippet">
                    <SearchHighlight
                      :text="row.hit.snippet"
                      :range="row.hit.highlight"
                    />
                  </span>
                </template>
              </span>
            </div>
            <div
              v-for="side in row.options.slice(1)"
              :id="side.id"
              :key="side.id"
              class="command-menu__side"
              role="option"
              :aria-label="side.ariaLabel"
              :aria-selected="side.id === active?.id"
              @pointermove="hover(side.id)"
              @click="emit('open', side.action)"
            >
              {{ side.label }}
            </div>
          </div>
        </template>
      </div>
    </div>
    <p v-if="searching && trimmed.length >= 2" class="command-menu__note">
      Sucht in Titeln und Notizen …
    </p>
    <p v-else-if="searchFailed" class="command-menu__note">
      Titel und Notizen lassen sich gerade nicht durchsuchen.
    </p>
    <div v-if="nothingFound" class="command-menu__empty">
      <p>Nichts gefunden für „{{ trimmed }}“.</p>
      <p class="command-menu__empty-scope">
        {{
          trimmed.length < 2
            ? "Titel und Notizen werden ab zwei Zeichen durchsucht."
            : SCOPE
        }}
      </p>
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </ModalDialog>
</template>

<style scoped>
/* Near the top, so the list grows downwards while typing. */
@media (min-width: 40rem) {
  .modal-dialog.command-menu {
    margin-top: min(12vh, 6rem);
  }
}

/*
 * A phone: the sheet takes its full height from the start, so it does not
 * jump while typing, and only the list scrolls; field and title stay.
 */
@media (max-width: 39.99rem) {
  .modal-dialog.command-menu[open] {
    display: flex;
    flex-direction: column;
    height: calc(
      var(--sheet-viewport-height, 100dvh) -
        max(var(--space-6), env(safe-area-inset-top, 0px) + var(--space-3))
    );
    overflow: hidden;
  }

  .modal-dialog.command-menu :deep(.modal-dialog__content) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  /* Ahead of the list's own rule below, so it needs the menu's class. */
  .command-menu .command-menu__list {
    flex: 1 1 auto;
    align-content: start;
    min-height: 0;
    max-height: none;
  }
}

.command-menu__search {
  margin-bottom: var(--space-3);
}

.command-menu__scope,
.command-menu__note {
  margin: 0 0 var(--space-3);
  padding: 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.command-menu__note {
  margin: var(--space-3) 0 0;
}

.command-menu__list {
  display: grid;
  gap: var(--space-3);
  max-height: min(60vh, 26rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.command-menu__list:empty {
  display: none;
}

.command-menu__group {
  display: grid;
  gap: 0.125rem;
}

.command-menu__heading {
  margin: 0 0 var(--space-1);
  padding: 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.command-menu__option {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;
}

/* A found entry: its title or place, below it what it is or the snippet. */
.command-menu__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.125rem var(--space-1);
  align-items: center;
}

.command-menu__option--hit {
  flex: 1 1 14rem;
  min-width: 0;
  padding-block: var(--space-2);
}

.command-menu__hit {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.command-menu__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  align-items: center;
  min-width: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.command-menu__snippet {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
}

/* Side actions of a quest: quiet pills beside it, in tap size. */
.command-menu__side {
  display: inline-flex;
  flex: none;
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

/* The active option is ink on apricot, the way the filter menu hovers. */
.command-menu__option[aria-selected="true"],
.command-menu__side[aria-selected="true"] {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.command-menu__option[aria-selected="true"] .command-menu__meta,
.command-menu__option[aria-selected="true"] .command-menu__snippet {
  color: var(--color-ink);
}

.command-menu__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.command-menu__keys {
  flex: none;
}

.command-menu__empty {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink-muted);
  text-align: center;
}

.command-menu__empty p {
  margin: 0;
}

.command-menu__empty-scope {
  font-size: 0.875rem;
}
</style>
