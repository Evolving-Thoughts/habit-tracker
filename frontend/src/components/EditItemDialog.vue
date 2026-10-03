<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModalDialog from "./ModalDialog.vue";
import PlannerItemEditor from "./PlannerItemEditor.vue";
defineProps<{
  kind: "todo" | "habit";
  entityId: number;
  returnFocus: () => HTMLElement | null;
}>();
const emit = defineEmits<{ close: []; changed: []; busy: [value: boolean] }>();
const editorBusy = ref(true);
const refreshing = ref(false);
const busy = computed(() => editorBusy.value || refreshing.value);
watch(busy, (value) => emit("busy", value), { immediate: true });
function close(): void {
  if (!busy.value) emit("close");
}
function changed(): void {
  refreshing.value = true;
  emit("changed");
}
</script>
<template>
  <ModalDialog
    class="edit-dialog"
    :title="kind === 'todo' ? 'Todo bearbeiten' : 'Habit bearbeiten'"
    :busy="busy"
    :return-focus="returnFocus"
    focus-selector='input[name="title"]'
    @close="close"
  >
    <PlannerItemEditor
      :kind="kind"
      :entity-id="entityId"
      embedded
      @busy="editorBusy = $event"
      @changed="changed"
      @close="close"
    />
  </ModalDialog>
</template>
