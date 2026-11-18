<script setup lang="ts">
import { computed } from "vue";
import ModalDialog from "./ModalDialog.vue";

/**
 * The question before a campaign with open quests is completed. Only the
 * campaign itself is completed; the quests below keep their state and
 * their day, which is what the lead says.
 */
const props = defineProps<{
  title: string;
  open: number;
  returnFocus?: () => HTMLElement | null;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const lead = computed(() =>
  props.open === 1
    ? `1 Quest in „${props.title}“ ist noch offen. Sie bleibt offen; die Kampagne steht danach unter „Abgeschlossen“.`
    : `${props.open} Quests in „${props.title}“ sind noch offen. Sie bleiben offen; die Kampagne steht danach unter „Abgeschlossen“.`,
);
</script>

<template>
  <ModalDialog
    title="Kampagne abschließen?"
    focus-selector="[data-campaign-confirm]"
    :return-focus="returnFocus"
    @close="emit('cancel')"
  >
    <p class="campaign-completion__lead">{{ lead }}</p>
    <div class="campaign-completion__actions">
      <button
        class="btn btn--primary"
        type="button"
        data-campaign-confirm
        data-primary
        @click="emit('confirm')"
      >
        Kampagne abschließen
      </button>
      <button class="btn" type="button" @click="emit('cancel')">
        Abbrechen
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.campaign-completion__lead {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}

.campaign-completion__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
