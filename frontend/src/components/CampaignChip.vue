<script setup lang="ts">
import { computed } from "vue";
import { isCampaignIcon } from "../utils/campaign-style";
import { campaignMark } from "../utils/category-mark";
import AppIcon from "./AppIcon.vue";

/**
 * Which campaign an entry works towards, readable without colour: a small
 * badge in the campaign's mark with its icon, then its name. A long name
 * ends in an ellipsis; the tooltip and screen readers get it whole. The
 * stripe on the card says the same in colour; the chip never relies on it.
 */
const props = defineProps<{
  campaign: { title: string; color?: string | null; icon?: string | null };
}>();

const mark = computed(() => campaignMark(props.campaign)!);
const icon = computed(() =>
  isCampaignIcon(props.campaign.icon) ? props.campaign.icon : "campaigns",
);
</script>

<template>
  <span
    class="campaign-chip"
    :style="{ '--mark': mark }"
    :title="campaign.title"
  >
    <span class="campaign-chip__badge" aria-hidden="true">
      <AppIcon :name="icon" />
    </span>
    <span class="visually-hidden">Kampagne </span>
    <span class="campaign-chip__name">{{ campaign.title }}</span>
  </span>
</template>

<style scoped>
/*
 * A pill on the card's own white, so the badge always sits on surface. In a
 * line that wraps it keeps icon and name and moves on to the next line
 * rather than shrinking to its badge; only a name longer than the whole
 * line ends in an ellipsis.
 */
.campaign-chip {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.3125rem;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  height: 1.375rem;
  padding: 0 0.5rem 0 0.125rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
}

.campaign-chip__badge {
  display: grid;
  flex: none;
  width: 1.0625rem;
  height: 1.0625rem;
  place-items: center;
  border-radius: 50%;
  background: var(--mark);
  color: var(--color-on-action);
}

.campaign-chip__badge :deep(svg) {
  width: 0.6875rem;
  height: 0.6875rem;
  stroke-width: 2.6;
}

.campaign-chip__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
