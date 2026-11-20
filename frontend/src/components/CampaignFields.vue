<script setup lang="ts">
import { computed } from "vue";
import {
  CAMPAIGN_ICONS,
  type CampaignColor,
  type CampaignIcon,
} from "../types/campaign";
import { ICON_NAMES } from "../utils/campaign-style";
import { categoryMark } from "../utils/category-mark";
import { MAX_TARGET_HOURS } from "../utils/quest-hours";
import AppIcon from "./AppIcon.vue";
import MarkPicker from "./MarkPicker.vue";

const props = defineProps<{
  idPrefix: string;
  /** The campaign's title, which picks the colour while none is chosen. */
  title: string;
}>();

const color = defineModel<CampaignColor | null>("color", { required: true });
const icon = defineModel<CampaignIcon | null>("icon", { required: true });
/** Hours as typed; empty means no weekly goal. */
const target = defineModel<string | number>("target", { required: true });

const automatic = computed(() => categoryMark(props.title));
const iconName = computed(() =>
  icon.value ? ICON_NAMES[icon.value] : "Kein Symbol",
);
</script>

<template>
  <div class="campaign-fields">
    <MarkPicker
      v-model="color"
      :name="`${idPrefix}-color`"
      legend="Farbe der Kampagne"
      :automatic="automatic"
      automatic-label="Automatisch aus dem Titel"
    />

    <fieldset class="campaign-fields__group">
      <legend>Symbol</legend>
      <div class="campaign-fields__choices">
        <label class="campaign-fields__icon">
          <input
            v-model="icon"
            class="visually-hidden"
            type="radio"
            :name="`${idPrefix}-icon`"
            :value="null"
          />
          <span class="campaign-fields__glyph" aria-hidden="true">–</span>
          <span class="visually-hidden">Kein Symbol</span>
        </label>
        <label
          v-for="key in CAMPAIGN_ICONS"
          :key="key"
          class="campaign-fields__icon"
        >
          <input
            v-model="icon"
            class="visually-hidden"
            type="radio"
            :name="`${idPrefix}-icon`"
            :value="key"
          />
          <AppIcon :name="key" />
          <span class="visually-hidden">{{ ICON_NAMES[key] }}</span>
        </label>
      </div>
      <p class="campaign-fields__chosen" aria-hidden="true">{{ iconName }}</p>
    </fieldset>

    <div class="field">
      <label :for="`${idPrefix}-weekly-target`"
        >Wochenziel in Stunden · optional</label
      >
      <input
        :id="`${idPrefix}-weekly-target`"
        v-model="target"
        name="weeklyTarget"
        type="number"
        inputmode="decimal"
        min="0.5"
        :max="MAX_TARGET_HOURS"
        step="0.5"
        :aria-describedby="`${idPrefix}-weekly-target-hint`"
      />
      <small
        :id="`${idPrefix}-weekly-target-hint`"
        class="campaign-fields__hint"
        >Zeit auf den Quests dieser Kampagne zählt als Kampagnen-Stunden. Halbe
        Stunden gehen auch.</small
      >
    </div>
  </div>
</template>

<style scoped>
.campaign-fields {
  display: grid;
  gap: var(--space-4);
}

.campaign-fields__group {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.campaign-fields__group legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.campaign-fields__choices {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.campaign-fields__icon {
  position: relative;
  display: grid;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  cursor: pointer;
}





.campaign-fields__icon:active {
  transform: scale(0.92);
  transition-duration: 90ms;
}

.campaign-fields__icon {
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-control);
  color: var(--color-ink-muted);
  transition: transform 420ms var(--spring);
}

.campaign-fields__icon:has(input:checked) {
  border-color: var(--color-ink);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: inset 0 0 0 1px var(--color-ink);
}

.campaign-fields__glyph {
  font-weight: 800;
}

.campaign-fields__icon:has(input:focus-visible) {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

.campaign-fields__chosen {
  margin: 0;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 700;
}

.campaign-fields__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
</style>
