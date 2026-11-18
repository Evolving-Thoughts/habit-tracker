<script setup lang="ts">
import ModalDialog from "./ModalDialog.vue";
import ShortcutList from "./ShortcutList.vue";
import { isMac, singleKeys } from "../composables/useShortcuts";
import { hrefOf } from "../routes";

/** "?": every shortcut in one dialog. */
const emit = defineEmits<{ close: [] }>();
const modifier = isMac ? "⌘" : "Strg";
</script>

<template>
  <ModalDialog
    class="shortcut-overview"
    title="Tastenkürzel"
    focus-selector=".modal-dialog__close"
    @close="emit('close')"
  >
    <p class="shortcut-overview__lead">
      <template v-if="singleKeys">
        Einzelne Tasten wirken nicht, solange du in einem Feld schreibst.
      </template>
      <template v-else>
        Einzelne Tasten sind ausgeschaltet; {{ modifier }}+K und
        {{ modifier }}+Enter wirken weiter.
      </template>
      Ein- und ausschalten kannst du sie in den
      <a :href="hrefOf('settings')" @click="emit('close')">Einstellungen</a>.
    </p>
    <ShortcutList />
  </ModalDialog>
</template>

<style scoped>
.shortcut-overview__lead {
  max-width: 60ch;
  margin: 0 0 var(--space-5);
  color: var(--color-ink-muted);
}
</style>
