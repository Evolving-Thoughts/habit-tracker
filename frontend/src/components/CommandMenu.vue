<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import KeyCombo from "./KeyCombo.vue";
import ModalDialog from "./ModalDialog.vue";
import { singleKeys, useKeyboardLikely } from "../composables/useShortcuts";
import { filterCommands, type Command } from "../utils/command-filter";
import { isSingleKey, shortcutById } from "../utils/shortcuts";

/**
 * Ctrl+K: every view and the common actions in one searchable list. The
 * field is a combobox; arrow keys move through the options, Enter runs one.
 */
const props = defineProps<{ commands: readonly Command[] }>();
const emit = defineEmits<{ run: [command: Command]; close: [] }>();

const keyboardLikely = useKeyboardLikely();
const query = ref("");
const active = ref(0);
const list = ref<HTMLElement | null>(null);

const results = computed(() => filterCommands(props.commands, query.value));
/** Grouped while nothing is typed; a search shows its best matches first. */
const sections = computed(() => {
  if (query.value.trim()) return [{ group: null, commands: results.value }];
  return (["Ansichten", "Aktionen"] as const)
    .map((group) => ({
      group,
      commands: results.value.filter((command) => command.group === group),
    }))
    .filter((section) => section.commands.length);
});
/** The options in the order they are shown. */
const shown = computed(() => sections.value.flatMap((s) => s.commands));
const activeCommand = computed(() => shown.value[active.value] ?? null);

const optionId = (command: Command) =>
  `command-${command.id.replace(/\W/g, "-")}`;

watch(query, () => (active.value = 0));
watch(active, async () => {
  await nextTick();
  const option = activeCommand.value
    ? list.value?.querySelector<HTMLElement>(
        `#${optionId(activeCommand.value)}`,
      )
    : null;
  option?.scrollIntoView?.({ block: "nearest" });
});

/** Shown only where it works: single keys switched off show no key. */
function caps(command: Command) {
  if (!keyboardLikely.value || !command.shortcut) return null;
  const shortcut = shortcutById(command.shortcut);
  if (isSingleKey(shortcut) && !singleKeys.value) return null;
  return shortcut;
}

function move(to: number): void {
  const count = shown.value.length;
  if (!count) return;
  active.value = (to + count) % count;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    emit("close");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    move(active.value + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    move(active.value - 1);
  } else if (event.key === "Home" && shown.value.length) {
    event.preventDefault();
    active.value = 0;
  } else if (event.key === "End" && shown.value.length) {
    event.preventDefault();
    active.value = shown.value.length - 1;
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (activeCommand.value) emit("run", activeCommand.value);
  }
}
</script>

<template>
  <ModalDialog
    class="command-menu"
    title="Befehle"
    focus-selector=".command-menu__search"
    @close="emit('close')"
  >
    <input
      v-model="query"
      class="input command-menu__search"
      type="text"
      role="combobox"
      aria-label="Ansicht oder Aktion suchen"
      aria-autocomplete="list"
      :aria-expanded="shown.length > 0"
      aria-controls="command-menu-list"
      :aria-activedescendant="
        activeCommand ? optionId(activeCommand) : undefined
      "
      placeholder="Ansicht oder Aktion suchen …"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="go"
      @keydown="onKeydown"
    />
    <div
      id="command-menu-list"
      ref="list"
      class="command-menu__list"
      role="listbox"
      aria-label="Befehle"
    >
      <div
        v-for="section in sections"
        :key="section.group ?? 'results'"
        class="command-menu__group"
        :role="section.group ? 'group' : 'presentation'"
        :aria-label="section.group ?? undefined"
      >
        <p
          v-if="section.group"
          class="command-menu__heading"
          aria-hidden="true"
        >
          {{ section.group }}
        </p>
        <div
          v-for="command in section.commands"
          :id="optionId(command)"
          :key="command.id"
          class="command-menu__option"
          role="option"
          :aria-selected="command === activeCommand"
          @pointermove="active = shown.indexOf(command)"
          @click="emit('run', command)"
        >
          <span class="command-menu__label">{{ command.label }}</span>
          <KeyCombo
            v-if="caps(command)"
            :shortcut="caps(command)!"
            class="command-menu__keys"
          />
        </div>
      </div>
    </div>
    <p v-if="!shown.length" class="command-menu__empty">
      Nichts gefunden für „{{ query.trim() }}“.
    </p>
    <p class="visually-hidden" role="status">
      {{
        !query.trim()
          ? ""
          : shown.length === 1
            ? "1 Treffer"
            : shown.length
              ? `${shown.length} Treffer`
              : `Nichts gefunden für „${query.trim()}“.`
      }}
    </p>
  </ModalDialog>
</template>

<style scoped>
/* Near the top, so the list grows downwards while typing. */
.modal-dialog.command-menu {
  margin-top: min(12vh, 6rem);
}

.command-menu__search {
  margin-bottom: var(--space-3);
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

/* The active option is ink on apricot, the way the filter menu hovers. */
.command-menu__option[aria-selected="true"] {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.command-menu__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.command-menu__keys {
  flex: none;
}

.command-menu__empty {
  margin: var(--space-2) 0 0;
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink-muted);
  text-align: center;
}
</style>
