<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { deleteHabit } from "../api/day-planner.api";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import ModalDialog from "./ModalDialog.vue";
import TodoDeletionSummary from "./TodoDeletionSummary.vue";

/** What a card's "Löschen" deletes: a quest with its subtree, or a whole daily. */
export type DeleteTarget = {
  kind: "todo" | "habit";
  id: number;
  title: string;
  /** A campaign: the dialog names it so, not "Quest". */
  campaign?: boolean;
};

/**
 * "Löschen" from a card's menu, the same steps as in the editor: a quest
 * shows what goes with it (the server's preview, deleted only as previewed),
 * a daily says that the whole daily goes. Only "Ja, löschen" is red.
 * Nothing can be undone here: deleted entries leave the views, the Logbuch
 * keeps what was done and measured.
 */
const props = defineProps<{
  target: DeleteTarget;
  returnFocus: () => HTMLElement | null;
}>();
const emit = defineEmits<{
  close: [];
  deleted: [];
  busy: [value: boolean];
}>();

const { preview, prepare, confirm, cancel } = useTodoDeletion();
const loading = ref(props.target.kind === "todo");
const busy = ref(false);
const errorMessage = ref<string | null>(null);
watch(busy, (value) => emit("busy", value));

onMounted(async () => {
  if (props.target.kind !== "todo") return;
  try {
    await prepare(props.target.id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Löschvorschau konnte nicht geladen werden.";
  } finally {
    loading.value = false;
  }
});

async function remove(): Promise<void> {
  if (busy.value || loading.value) return;
  busy.value = true;
  errorMessage.value = null;
  try {
    if (props.target.kind === "todo") await confirm();
    else await deleteHabit(props.target.id);
    emit("deleted");
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
    // A changed subtree needs a fresh look before it can go.
    if (props.target.kind === "todo")
      await prepare(props.target.id).catch(() => undefined);
  } finally {
    busy.value = false;
  }
}

function close(): void {
  if (busy.value) return;
  cancel();
  emit("close");
}
</script>

<template>
  <ModalDialog
    :title="
      target.kind === 'habit'
        ? 'Daily löschen'
        : target.campaign
          ? 'Kampagne löschen'
          : 'Quest löschen'
    "
    :busy="busy"
    :return-focus="returnFocus"
    focus-selector="[data-cancel-delete]"
    @close="close"
  >
    <div class="delete-dialog">
      <p v-if="loading" role="status">Löschvorschau wird geladen …</p>
      <TodoDeletionSummary
        v-if="preview"
        :preview="preview"
        :campaign="target.campaign"
      />
      <p v-if="!loading">„{{ target.title }}“ wirklich löschen?</p>
      <p v-if="target.kind === 'habit'" class="delete-dialog__hint">
        Das ganze Daily verschwindet aus Heute und allen Tagen. Das Logbuch
        bleibt erhalten.
      </p>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="delete-dialog__actions">
        <button
          class="btn btn--danger"
          type="button"
          data-test="confirm-delete"
          :disabled="loading || (target.kind === 'todo' && !preview)"
          @click="remove"
        >
          Ja, löschen
        </button>
        <button class="btn" type="button" data-cancel-delete @click="close">
          Nicht löschen
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.delete-dialog {
  display: grid;
  gap: var(--space-3);
}

.delete-dialog p {
  margin: 0;
}

.delete-dialog__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.delete-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* ModalDialog tints every button; the last step keeps the danger tint. */
.delete-dialog button.btn--danger:not(:disabled) {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}
</style>
