<script setup lang="ts">
import { useId } from "vue";

/**
 * "Quest | Daily" at the top of the create dialog and of a quest's editor:
 * a radio group in the look of the segmented choice. What switching means
 * is up to the form around it (a new entry just swaps the form).
 */
const kind = defineModel<"todo" | "habit">({ required: true });
const name = useId();
</script>

<template>
  <div class="segmented kind-switch" role="radiogroup" aria-label="Art">
    <label>
      <input
        v-model="kind"
        type="radio"
        :name="name"
        value="todo"
        data-test="kind-todo"
      />
      Quest
    </label>
    <label>
      <input
        v-model="kind"
        type="radio"
        :name="name"
        value="habit"
        data-test="kind-habit"
      />
      Daily
    </label>
  </div>
</template>

<style scoped>
.kind-switch {
  justify-self: start;
}
</style>
