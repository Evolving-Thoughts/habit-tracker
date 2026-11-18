<script setup lang="ts">
import {
  THEME_CHOICES,
  setThemeChoice,
  theme,
  themeChoice,
} from "../composables/useTheme";

/**
 * Light, dark or as the device says, stored on this device. A radio group
 * in the segmented look: arrow keys move the choice, as with any radios.
 */
</script>

<template>
  <div class="theme-setting">
    <div
      class="segmented theme-setting__choices"
      role="radiogroup"
      aria-labelledby="settings-theme"
      aria-describedby="theme-setting-text"
    >
      <label v-for="choice in THEME_CHOICES" :key="choice.value">
        <input
          type="radio"
          name="theme"
          :value="choice.value"
          :checked="themeChoice === choice.value"
          @change="setThemeChoice(choice.value)"
        />
        {{ choice.label }}
      </label>
    </div>
    <p id="theme-setting-text" class="theme-setting__text">
      Gilt auf diesem Gerät.
      <template v-if="themeChoice === 'system'">
        Gerade {{ theme === "dark" ? "dunkel" : "hell" }}, wie dein Gerät.
      </template>
    </p>
  </div>
</template>

<style scoped>
.theme-setting {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.theme-setting__choices {
  flex-wrap: wrap;
  max-width: 100%;
}

/* Three choices fit a phone in one row. */
.theme-setting__choices > label {
  padding: 0 var(--space-3);
}

.theme-setting__text {
  margin: 0;
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}
</style>
