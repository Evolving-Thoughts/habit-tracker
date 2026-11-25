<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useId } from "vue";
import {
  describeDictation,
  removeWhisperModel,
  type DictationDevice,
} from "../composables/useDictation";
import { useVoiceInputSettings } from "../composables/useVoiceInputSettings";

/**
 * "Spracheingabe" in Einstellungen (docs/voice-input.md): the switch for
 * every microphone on this device, and what recognises speech here. In the
 * browser that is Whisper, whose model can be removed again; in the
 * Android app the phone's own recogniser, which may still need the German
 * offline pack.
 */
const { settings, update } = useVoiceInputSettings();
const id = useId();

const device = shallowRef<DictationDevice | null>(null);
const working = ref(false);
/** What the last button did, said quietly. */
const note = ref("");

async function refresh(): Promise<void> {
  device.value = await describeDictation();
}
onMounted(refresh);

const engineText = computed(() => {
  const current = device.value;
  if (!current) return "";
  switch (current.engine) {
    case "native":
      return "Auf diesem Gerät erkennt Android die Sprache selbst, ohne Internet.";
    case "whisper":
      return `Auf diesem Gerät erkennt Whisper im Browser die Sprache (${current.plan.model.split("/").pop()}, ~${current.plan.megabytes} MB).`;
    case "stub":
      return "Testmodus: Die Erkennung ist nachgestellt.";
    default:
      return "Dieses Gerät kann Sprache nicht selbst erkennen. Darum zeigt die App hier kein Mikrofon.";
  }
});

async function removeModel(): Promise<void> {
  working.value = true;
  note.value = "";
  try {
    await removeWhisperModel();
    note.value =
      "Sprachmodell entfernt. Beim nächsten Diktat fragt die App vor dem Laden.";
  } catch {
    note.value = "Das Sprachmodell ließ sich nicht entfernen.";
  } finally {
    working.value = false;
    await refresh();
  }
}

async function runSetup(): Promise<void> {
  const current = device.value;
  const action = current?.engine === "native" ? current.setup?.action : null;
  if (!action) return;
  working.value = true;
  try {
    note.value = (await action.run()) ?? "";
  } catch {
    note.value =
      "Die Einstellungen ließen sich nicht öffnen. Such die Offline-Spracherkennung bitte von Hand.";
  } finally {
    working.value = false;
  }
}
</script>

<template>
  <div class="voice-settings">
    <div class="voice-settings__row">
      <span :id="`${id}-label`" class="voice-settings__label"
        >Spracheingabe</span
      >
      <button
        class="switch"
        type="button"
        role="switch"
        :aria-labelledby="`${id}-label`"
        :aria-describedby="`${id}-text`"
        :aria-checked="settings.enabled"
        @click="update({ enabled: !settings.enabled })"
      >
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </div>
    <p :id="`${id}-text`" class="voice-settings__text">
      Ein Mikrofon an Quests, Notizen und Rückblicken. Die Erkennung läuft auf
      deinem Gerät; Aufnahmen verlassen es nicht.
    </p>
    <p class="visually-hidden" role="status">
      {{
        settings.enabled
          ? "Spracheingabe ist eingeschaltet."
          : "Spracheingabe ist ausgeschaltet."
      }}
    </p>

    <template v-if="device">
      <p class="voice-settings__text" data-test="voice-engine">
        {{ engineText }}
      </p>

      <div
        v-if="device.engine === 'whisper'"
        class="voice-settings__model"
      >
        <p class="voice-settings__text">
          {{
            device.stored
              ? "Das Sprachmodell ist geladen; Diktieren geht auch offline."
              : "Das Sprachmodell lädt beim ersten Diktat, nach einer Rückfrage."
          }}
        </p>
        <button
          v-if="device.stored"
          class="btn"
          type="button"
          :disabled="working"
          @click="removeModel"
        >
          Sprachmodell entfernen
        </button>
      </div>

      <div
        v-else-if="device.engine === 'native' && device.setup"
        class="voice-settings__setup"
      >
        <p>{{ device.setup.message }}</p>
        <ol>
          <li v-for="step in device.setup.steps" :key="step">{{ step }}</li>
        </ol>
        <button
          v-if="device.setup.action"
          class="btn"
          type="button"
          :disabled="working"
          @click="runSetup"
        >
          {{ device.setup.action.label }}
        </button>
      </div>
    </template>
    <p
      class="voice-settings__note"
      :class="{ 'voice-settings__note--empty': !note }"
      role="status"
    >
      {{ note }}
    </p>
  </div>
</template>

<style scoped>
.voice-settings {
  display: grid;
  gap: var(--space-2);
}

.voice-settings p {
  margin: 0;
}

.voice-settings__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
}

.voice-settings__label {
  font-weight: 700;
}

.voice-settings__text {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.voice-settings__model {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
}

/* The missing offline pack: a calm surface with the steps, as for push. */
.voice-settings__setup {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  max-width: 65ch;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  text-wrap: pretty;
}

.voice-settings__setup ol {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-ink-muted);
}

.voice-settings__note {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

/* Kept in the page while empty, so the next note is announced. */
.voice-settings__note--empty {
  position: absolute;
}
</style>
