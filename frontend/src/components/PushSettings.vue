<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  disablePush,
  enablePush,
  pushConfig,
  restorePush,
  supported,
  type PushConfig,
} from "../push/device";
import { readPreference } from "../push/preferences";
const busy = ref(false);
const enabled = ref(false);
const available = ref(false);
const permission = ref<NotificationPermission>("default");
const config = ref<PushConfig>({ configured: false, publicKey: null });
const error = ref("");
let alive = true;
async function refresh(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    available.value = supported();
    permission.value =
      typeof Notification === "undefined" ? "default" : Notification.permission;
    config.value = await pushConfig();
    if (available.value) await restorePush(config.value);
    if (alive && available.value)
      enabled.value = (await readPreference()).enabled;
  } catch (cause) {
    if (alive)
      error.value =
        cause instanceof Error
          ? cause.message
          : "Push konnte nicht eingerichtet werden.";
  } finally {
    if (alive) busy.value = false;
  }
}
async function toggle(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (enabled.value) await disablePush();
    else await enablePush(config.value, true);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Änderung fehlgeschlagen.";
  } finally {
    try {
      enabled.value = (await readPreference()).enabled;
    } catch {
      error.value ||= "Geräteeinstellung konnte nicht gelesen werden.";
    }
    permission.value = Notification.permission;
    busy.value = false;
  }
}
function visibility(): void {
  if (!document.hidden) void refresh();
}
onMounted(() => {
  void refresh();
  document.addEventListener("visibilitychange", visibility);
});
onUnmounted(() => {
  alive = false;
  document.removeEventListener("visibilitychange", visibility);
});
</script>
<template>
  <div class="push-settings">
    <div class="push-settings__row">
      <span id="push-settings-label" class="push-settings__label">
        Timer-Benachrichtigungen
      </span>
      <button
        v-if="
          available &&
          (enabled || (config.configured && permission !== 'denied'))
        "
        data-test="push-toggle"
        class="push-switch"
        type="button"
        role="switch"
        aria-labelledby="push-settings-label"
        :aria-checked="enabled"
        :disabled="busy"
        @click="toggle"
      >
        <span class="push-switch__track" aria-hidden="true">
          <span class="push-switch__thumb" />
        </span>
      </button>
    </div>
    <p class="push-settings__text">
      Meldet auf diesem Gerät, wenn ein Timer abläuft, ohne Aufgaben- oder
      Habit-Titel.
    </p>
    <p class="visually-hidden" role="status">
      {{
        busy
          ? "Einstellung wird geprüft …"
          : enabled
            ? "Auf diesem Gerät aktiviert"
            : "Auf diesem Gerät deaktiviert"
      }}
    </p>
    <p v-if="!available" class="push-settings__hint">
      Dieser Browser kann hier keine Benachrichtigungen anzeigen. Öffne die App
      dafür als installierte App auf deinem Handy.
    </p>
    <p v-else-if="!config.configured" class="push-settings__hint">
      Benachrichtigungen sind auf dem Server noch nicht eingerichtet.
    </p>
    <p v-else-if="permission === 'denied'" class="push-settings__hint">
      Dein Browser blockiert Benachrichtigungen für diese App. Du kannst sie in
      den Website-Einstellungen des Browsers wieder erlauben.
    </p>
    <template v-if="error">
      <p class="form-error" role="alert">{{ error }}</p>
      <button
        class="btn push-settings__retry"
        type="button"
        :disabled="busy"
        @click="refresh"
      >
        Erneut prüfen
      </button>
    </template>
  </div>
</template>
<style scoped>
.push-settings {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
}
.push-settings p {
  margin: 0;
}
.push-settings__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  justify-self: stretch;
  min-height: var(--tap);
}
.push-settings__label {
  font-weight: 700;
}
.push-settings__text,
.push-settings__hint {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}
.push-settings__hint {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink);
}
.push-settings__retry {
  margin-top: var(--space-1);
}
/* The switch: a 2.75rem tap target around a small track. */
.push-switch {
  display: inline-grid;
  place-items: center;
  flex: none;
  min-width: 3.75rem;
  min-height: var(--tap);
  margin-inline-end: calc(var(--space-2) * -1);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}
.push-switch:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}
.push-switch:disabled {
  cursor: progress;
}
.push-switch__track {
  display: flex;
  align-items: center;
  width: 3rem;
  height: 1.75rem;
  padding: 0.1875rem;
  border-radius: var(--radius-pill);
  background: var(--color-ink-soft);
  transition: background-color 160ms var(--ease-out);
}
.push-switch__thumb {
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgb(43 29 22 / 20%);
  transition: transform 320ms var(--spring);
}
.push-switch[aria-checked="true"] .push-switch__track {
  background: var(--color-action);
}
.push-switch[aria-checked="true"] .push-switch__thumb {
  transform: translateX(1.25rem);
}
.push-switch:disabled .push-switch__track {
  opacity: 0.6;
}
</style>
