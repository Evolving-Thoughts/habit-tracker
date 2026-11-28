<script setup lang="ts">
import { computed } from "vue";
import type { RowDialogs } from "../composables/useRowDialogs";
import CampaignMoveDialog from "./CampaignMoveDialog.vue";
import DeleteItemDialog from "./DeleteItemDialog.vue";
import EditItemDialog from "./EditItemDialog.vue";
import MoveItemDialog from "./MoveItemDialog.vue";

/**
 * The dialog a row asked for (`useRowDialogs`): its editor, "Anderer Tag
 * …", "In Kampagne verschieben …" or "Löschen". Each reports its busy flag
 * and its save back to the module, which reloads and closes.
 */
const props = defineProps<{ dialogs: RowDialogs }>();
const open = computed(() => props.dialogs.dialog.value);
</script>

<template>
  <EditItemDialog
    v-if="open?.kind === 'edit'"
    :key="`${open.target.kind}-${open.target.id}`"
    :kind="open.target.kind"
    :entity-id="open.target.id"
    :occurrence-id="open.target.occurrenceId"
    :focus="open.target.focus"
    :campaign="open.target.campaign"
    :return-focus="dialogs.returnFocus"
    @busy="dialogs.report"
    @changed="dialogs.done"
    @close="dialogs.close"
  />
  <MoveItemDialog
    v-else-if="open?.kind === 'move'"
    :item="open.target"
    :today="dialogs.today()"
    :offer-today="open.offerToday"
    :return-focus="dialogs.returnFocus"
    @busy="dialogs.report"
    @moved="dialogs.done"
    @close="dialogs.close"
  />
  <CampaignMoveDialog
    v-else-if="open?.kind === 'reparent'"
    :todo-id="open.target.todoId"
    :title="open.target.title"
    :return-focus="dialogs.returnFocus"
    @busy="dialogs.report"
    @moved="dialogs.done"
    @close="dialogs.close"
  />
  <DeleteItemDialog
    v-else-if="open?.kind === 'delete'"
    :target="open.target"
    :return-focus="dialogs.returnFocus"
    @busy="dialogs.report"
    @deleted="dialogs.done"
    @close="dialogs.close"
  />
</template>
