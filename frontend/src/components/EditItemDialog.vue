<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ModalDialog from "./ModalDialog.vue";
import PlannerItemEditor from "./PlannerItemEditor.vue";
const props = defineProps<{
  kind: "todo" | "habit";
  entityId: number;
  /** A daily opened from one of its runs: that run's notes are shown. */
  occurrenceId?: number | null;
  returnFocus: () => HTMLElement | null;
  /** Where the focus starts; the title unless a view asks for its day. */
  focus?: string;
}>();
const emit = defineEmits<{ close: []; changed: []; busy: [value: boolean] }>();
// The editor reports only its writes; while it loads, Escape still closes.
const editorBusy = ref(false);
const refreshing = ref(false);
const busy = computed(() => editorBusy.value || refreshing.value);
watch(busy, (value) => emit("busy", value), { immediate: true });
/** A quest's editor switched to "Daily": the dialog says so. */
const mode = ref<"todo" | "habit">(props.kind);
const switched = ref(false);
function onMode(next: "todo" | "habit"): void {
  switched.value = true;
  mode.value = next;
}
const title = computed(() =>
  props.kind === "habit"
    ? "Daily bearbeiten"
    : mode.value === "habit"
      ? "Quest als Daily speichern"
      : "Quest bearbeiten",
);
// Once the switch was used the focus stays on it, not on the new title field.
const focusSelector = computed(() =>
  switched.value
    ? ".kind-switch input:checked"
    : (props.focus ?? 'input[name="title"]'),
);
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
    :title="title"
    :busy="busy"
    :return-focus="returnFocus"
    :focus-selector="focusSelector"
    @close="close"
  >
    <PlannerItemEditor
      :kind="kind"
      :entity-id="entityId"
      :occurrence-id="occurrenceId"
      embedded
      @busy="editorBusy = $event"
      @changed="changed"
      @close="close"
      @mode="onMode"
    />
  </ModalDialog>
</template>
