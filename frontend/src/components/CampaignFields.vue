<script setup lang="ts">
import { computed } from "vue";
import {
  CAMPAIGN_COLORS,
  CAMPAIGN_ICONS,
  type CampaignColor,
  type CampaignIcon,
} from "../types/campaign";
import { COLOR_NAMES, ICON_NAMES, markToken } from "../utils/campaign-style";
import { categoryMark } from "../utils/category-mark";
import { MAX_TARGET_HOURS } from "../utils/quest-hours";
import AppIcon from "./AppIcon.vue";

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
const colorName = computed(() =>
  color.value ? COLOR_NAMES[color.value] : "Automatisch aus dem Titel",
);
const iconName = computed(() =>
  icon.value ? ICON_NAMES[icon.value] : "Kein Symbol",
);
</script>

<template>
  <div class="campaign-fields">
    <fieldset class="campaign-fields__group">
      <legend>Farbe der Kampagne</legend>
      <div class="campaign-fields__choices">
        <label
          class="campaign-fields__swatch"
          :style="{ '--swatch': automatic }"
        >
          <input
            v-model="color"
            class="visually-hidden"
            type="radio"
            :name="`${idPrefix}-color`"
            :value="null"
          />
          <span class="campaign-fields__dot campaign-fields__dot--auto">
            <AppIcon v-if="color === null" name="check" />
          </span>
          <span class="visually-hidden">Automatisch aus dem Titel</span>
        </label>
        <label
          v-for="key in CAMPAIGN_COLORS"
          :key="key"
          class="campaign-fields__swatch"
          :style="{ '--swatch': markToken(key) }"
        >
          <input
            v-model="color"
            class="visually-hidden"
            type="radio"
            :name="`${idPrefix}-color`"
            :value="key"
          />
          <span class="campaign-fields__dot">
            <AppIcon v-if="color === key" name="check" />
          </span>
          <span class="visually-hidden">{{ COLOR_NAMES[key] }}</span>
        </label>
      </div>
      <p class="campaign-fields__chosen" aria-hidden="true">
        {{ colorName }}
      </p>
    </fieldset>

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
        >Zeit auf den Quests dieser Kampagne zählt als Quest-Stunden. Halbe
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

.campaign-fields__swatch,
.campaign-fields__icon {
  position: relative;
  display: grid;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  cursor: pointer;
}

.campaign-fields__dot {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 50%;
  background: var(--swatch);
  color: var(--color-on-action);
  transition: transform 420ms var(--spring);
}

/* The automatic colour shows as a ring, so it never looks chosen by hand. */
.campaign-fields__dot--auto {
  border: 0.3125rem solid var(--swatch);
  background: var(--color-surface);
  color: var(--color-ink);
}

.campaign-fields__dot :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 3;
}

.campaign-fields__swatch:has(input:checked) .campaign-fields__dot {
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 4px var(--color-ink);
}

.campaign-fields__swatch:active .campaign-fields__dot,
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

.campaign-fields__swatch:has(input:focus-visible) .campaign-fields__dot,
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
