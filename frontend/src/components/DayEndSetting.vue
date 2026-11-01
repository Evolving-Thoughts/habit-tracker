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
    <label>
      Tagesende
      <input v-model="dayEnd" type="time" :disabled="busy" @change="save" />
    </label>
    <p>Was „Neu planen“ bis dahin nicht unterbringt, rutscht auf morgen.</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.day-end-setting {
  display: grid;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.day-end-setting p {
  margin: 0;
}

.day-end-setting label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
