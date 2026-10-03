<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import ModalDialog from "./ModalDialog.vue";
import {
  disablePush,
  enablePush,
  pushConfig,
  restorePush,
  supported,
  type PushConfig,
} from "../push/device";
import { readPreference } from "../push/preferences";
const open = ref(false);
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
  <button type="button" @click="open = true">Benachrichtigungen</button>
  <ModalDialog
    v-if="open"
    title="Timer-Benachrichtigungen"
    :busy="busy"
    focus-selector='[data-test="push-toggle"]'
    @close="open = false"
  >
    <p>Diese Einstellung gilt nur für dieses Gerät und diesen Browser.</p>
    <p>
      Alle angemeldeten Geräte mit aktiviertem Push erhalten die neutrale
      Nachricht „Dein Timer ist abgelaufen“ — ohne Aufgaben- oder Habit-Titel.
    </p>
    <p role="status">
      {{
        busy
          ? "Einstellung wird geprüft …"
          : enabled
            ? "Auf diesem Gerät aktiviert"
            : "Auf diesem Gerät deaktiviert"
      }}
    </p>
    <p v-if="!available">
      Push benötigt einen unterstützten Browser und die gebaute PWA über HTTPS.
    </p>
    <p v-else-if="!config.configured">
      Push ist auf dem Server noch nicht eingerichtet.
    </p>
    <p v-else-if="permission === 'denied'">
      Benachrichtigungen sind durch den Browser blockiert. Du kannst die
      Erlaubnis in seinen Website-Einstellungen ändern.
    </p>
    <button
      v-if="
        available && (enabled || (config.configured && permission !== 'denied'))
      "
      data-test="push-toggle"
      type="button"
      role="switch"
      :aria-checked="enabled"
      :disabled="busy"
      @click="toggle"
    >
      {{ enabled ? "Push deaktivieren" : "Push aktivieren" }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="error" type="button" :disabled="busy" @click="refresh">
      Erneut prüfen
    </button>
    <p>
      Nach dem Abmelden werden keine neuen Meldungen an dieses Gerät versandt.
      Die Browser-Erlaubnis bleibt bestehen. Bewusst deaktiviertes Push bleibt
      auch nach einem neuen Login deaktiviert.
    </p>
    <p>
      Die Zustellung kann durch Android oder das Netzwerk verzögert werden. Für
      den Tunnel-Test müssen PC und Backend laufen.
    </p>
  </ModalDialog>
</template>
<style scoped>
p {
  margin: 0 0 1rem;
  color: #526481;
  line-height: 1.5;
}
button {
  min-height: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #fff;
  color: #2f3a4f;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
[role="alert"] {
  color: #b91c1c;
  margin-top: 1rem;
}
[role="switch"][aria-checked="true"] {
  background: #2457c5;
  color: white;
}
</style>
