<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
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
/** Turning it on opens the browser's own question first. */
const asksFirst = computed(
  () =>
    available.value &&
    config.value.configured &&
    !enabled.value &&
    permission.value === "default",
);
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
    // Refused in the browser's prompt: the steps below say how to undo it.
    if (Notification.permission !== "denied")
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
        Benachrichtigen, wenn das Soll erreicht ist
      </span>
      <button
        v-if="
          available &&
          (enabled || (config.configured && permission !== 'denied'))
        "
        data-test="push-toggle"
        class="switch"
        type="button"
        role="switch"
        aria-labelledby="push-settings-label"
        :aria-describedby="asksFirst ? 'push-settings-prompt' : undefined"
        :aria-checked="enabled"
        :disabled="busy"
        @click="toggle"
      >
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </div>
    <p class="push-settings__text">
      Meldet sich auf diesem Gerät, sobald eine Stoppuhr ihr Soll erreicht, ohne
      Quest- oder Daily-Titel. Die Stoppuhr läuft dabei weiter.
    </p>
    <p v-if="asksFirst" id="push-settings-prompt" class="push-settings__text">
      Der Browser fragt gleich, ob die App dir Benachrichtigungen schicken darf.
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
    <div v-else-if="!config.configured" class="push-settings__hint">
      <p>Benachrichtigungen sind auf dem Server noch nicht eingerichtet.</p>
      <p class="push-settings__operator">
        Frag die Person, die den Server betreibt.
      </p>
    </div>
    <div v-else-if="permission === 'denied'" class="push-settings__hint">
      <p>
        Dein Browser blockiert Benachrichtigungen für diese App. So erlaubst du
        sie wieder:
      </p>
      <ul class="push-settings__steps">
        <li>
          <strong>Chrome:</strong> links in der Adressleiste auf das Symbol vor
          der Adresse, dann „Website-Einstellungen“ und bei „Benachrichtigungen“
          „Zulassen“ wählen.
        </li>
        <li>
          <strong>Edge:</strong> auf das Schloss vor der Adresse, dann
          „Berechtigungen für diese Website“ und „Benachrichtigungen“ auf
          „Zulassen“ stellen.
        </li>
        <li>
          <strong>Firefox:</strong> auf das Symbol vor der Adresse und bei
          „Benachrichtigungen senden“ die Sperre mit dem × aufheben.
        </li>
        <li>
          <strong>Android, als installierte App:</strong> das App-Symbol lange
          drücken, „App-Info“ › „Benachrichtigungen“ einschalten.
        </li>
      </ul>
      <p>Danach die Seite neu laden und hier einschalten.</p>
    </div>
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
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink);
}
.push-settings__operator {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
.push-settings__steps {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: 1.25rem;
}
.push-settings__retry {
  margin-top: var(--space-1);
}
</style>
