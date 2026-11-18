<script setup lang="ts">
import { watch } from "vue";
import FormDisclosure from "./FormDisclosure.vue";

/**
 * "Termin (feste Uhrzeit)": the one optional time of a quest. Only an
 * appointment has one; everything else is worked through in the order of its
 * day, so the field waits behind a disclosure.
 */
const time = defineModel<string>("time", { required: true });
const props = defineProps<{ idPrefix: string; date: string }>();

// Without a day there is nothing an appointment could be on.
watch(
  () => props.date,
  (day) => {
    if (!day) time.value = "";
  },
);
</script>

<template>
  <FormDisclosure
    label="Termin"
    detail="feste Uhrzeit"
    :summary="time ? `${time} Uhr` : ''"
    :start-open="!!time"
  >
    <div class="field">
      <label :for="`${idPrefix}-time`">Uhrzeit</label>
      <input
        :id="`${idPrefix}-time`"
        v-model="time"
        name="timeOfDay"
        type="time"
        :disabled="!date"
        :aria-describedby="`${idPrefix}-time-hint`"
      />
      <small :id="`${idPrefix}-time-hint`" class="appointment-fields__hint">
        {{
          date
            ? "Nur für Termine. Alles andere erledigst du in deiner Reihenfolge."
            : "Ein Termin braucht einen Tag; wähle ihn oben."
        }}
      </small>
    </div>
  </FormDisclosure>
</template>

<style scoped>
.appointment-fields__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
</style>
