<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getReplan, setDayEnd } from "../api/replan.api";

const dayEnd = ref("");
const busy = ref(true);
const error = ref("");

async function run(work: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await work();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Das hat nicht geklappt.";
  } finally {
    busy.value = false;
  }
}

function save(): void {
  if (dayEnd.value) void run(() => setDayEnd(dayEnd.value));
}

onMounted(() =>
  run(async () => {
    dayEnd.value = (await getReplan()).dayEnd;
  }),
);
</script>

<template>
  <div class="day-end-setting">
    <label class="day-end-setting__row">
      <span>Mein Tag endet um</span>
      <input
        v-model="dayEnd"
        class="input day-end-setting__time"
        type="time"
        :disabled="busy"
        @change="save"
      />
    </label>
    <p class="day-end-setting__hint">
      Was „Neu planen“ bis dahin nicht unterbringt, rutscht auf morgen.
    </p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.day-end-setting {
  display: grid;
  gap: var(--space-2);
}

.day-end-setting p {
  margin: 0;
}

.day-end-setting__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  font-weight: 700;
}

.day-end-setting__time {
  width: 7.5rem;
  font-variant-numeric: tabular-nums;
}

.day-end-setting__time:disabled {
  color: var(--color-ink-soft);
}

.day-end-setting__hint {
  max-width: 60ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}
</style>
