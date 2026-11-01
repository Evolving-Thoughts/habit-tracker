<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getCategories } from "../api/categories.api";
import type { CategoryResponse } from "../types/category";

/** "default" sends nothing, so the server decides (a child takes its parent's). */
export type CategoryChoice = number | null | "default";

defineProps<{ id: string; inheritsFromParent?: boolean }>();
const choice = defineModel<CategoryChoice>({ default: "default" });
const categories = ref<CategoryResponse[]>([]);

onMounted(async () => {
  try {
    categories.value = await getCategories();
  } catch {
    // Creating an entry must still work without the optional category list.
    categories.value = [];
  }
});
</script>

<template>
  <select :id="id" v-model="choice" class="category-select" name="category">
    <option value="default">
      {{ inheritsFromParent ? "Wie übergeordnetes Todo" : "Keine" }}
    </option>
    <option v-if="inheritsFromParent" :value="null">Keine</option>
    <option
      v-for="category in categories"
      :key="category.id"
      :value="category.id"
    >
      {{ category.name }}
    </option>
  </select>
</template>

<style scoped>
.category-select {
  width: 100%;
  height: 3rem;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
}
</style>
