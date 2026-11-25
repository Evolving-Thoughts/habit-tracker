<script setup lang="ts">
import { computed, onMounted, ref, useId } from "vue";
import { useFocusBlock } from "../composables/useFocusBlock";
import type { InstalledApp } from "../native/focus-block-plugin";
import type {
  FocusBlockMode,
  FocusEntry,
  FocusList,
  FocusListMode,
  FocusTrigger,
} from "../types/focus-block";
import { FIXED_ALLOWED_APPS } from "../utils/focus-block";
import AppIcon from "./AppIcon.vue";
import FocusBlockSetupHint from "./FocusBlockSetupHint.vue";
import ModalDialog from "./ModalDialog.vue";

/**
 * Einstellungen › Fokus-Sperre: when a running stopwatch blocks (always,
 * or from a Soll on), Soft or Hardcore by default, which list decides, the
 * Sperrliste and the Erlaubt-Liste, and the two permissions the phone
 * needs. Switched off, only the switch and its sentence stand. Settings and
 * lists live on the server, so they can be edited on every device; only the
 * Android app blocks, so only there are apps picked and the device set up,
 * and a browser says so in one sentence instead.
 */
const focus = useFocusBlock();
const id = useId();
const state = computed(() => focus?.state.value ?? null);
const settings = computed(() => state.value?.settings ?? null);
const native = focus?.native ?? null;
const saved = ref("");
const hardcoreActive = computed(() => focus?.block.value?.mode === "hardcore");

async function save(
  change: Parameters<NonNullable<typeof focus>["saveSettings"]>[0],
): Promise<void> {
  saved.value = "";
  if (await focus?.saveSettings(change)) saved.value = "Gespeichert.";
}

const minutes = ref<string | null>(null);
const shownMinutes = computed(
  () => minutes.value ?? String(settings.value?.thresholdMinutes ?? ""),
);
const minutesError = ref("");
function onMinutes(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  minutes.value = value;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 600) {
    minutesError.value = "Gib ganze Minuten von 1 bis 600 an.";
    return;
  }
  minutesError.value = "";
  if (number === settings.value?.thresholdMinutes) return;
  void save({ thresholdMinutes: number }).then(() => {
    if (minutes.value === value) minutes.value = null;
  });
}

const MODES: { value: FocusBlockMode; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "hardcore", label: "Hardcore" },
];
const TRIGGERS: { value: FocusTrigger; label: string; text: string }[] = [
  {
    value: "stopwatch",
    label: "Solange die Stoppuhr läuft",
    text: "Jede Stoppuhr sperrt, egal wo du sie startest: Heute, Fokus-Modus, Plan, Questlog oder Benachrichtigung. Ein Soll braucht es nicht.",
  },
  {
    value: "threshold",
    label: "Erst ab einem Soll",
    text: "Nur eine Stoppuhr mit einem Soll ab so vielen Minuten sperrt.",
  },
];
const LIST_MODES: { value: FocusListMode; label: string; text: string }[] = [
  {
    value: "blocklist",
    label: "Nur die Sperrliste",
    text: "Gesperrt ist, was auf der Sperrliste steht; alles andere bleibt frei.",
  },
  {
    value: "allowlist",
    label: "Alles außer der Erlaubt-Liste",
    text: "Streng: Frei bleibt nur, was auf der Erlaubt-Liste steht, und was immer erlaubt ist.",
  },
];

/* Lists. */
const domains = ref<Record<FocusList, string>>({ block: "", allow: "" });
async function addDomain(list: FocusList): Promise<void> {
  const value = domains.value[list].trim();
  if (!value || !focus) return;
  if (await focus.addEntry({ list, kind: "domain", value }))
    domains.value[list] = "";
}
function entryName(entry: FocusEntry): string {
  return entry.kind === "app" ? (entry.label ?? entry.value) : entry.value;
}
const LISTS: FocusList[] = ["block", "allow"];
const LIST_NAMES: Record<FocusList, string> = {
  block: "Sperrliste",
  allow: "Erlaubt-Liste",
};
/** During Hardcore only stricter: adding to the Sperrliste. */
function canRemove(): boolean {
  return !hardcoreActive.value;
}
function canAdd(list: FocusList): boolean {
  return !hardcoreActive.value || list === "block";
}

/*
 * Android: the two permissions (read by the controller, again whenever the
 * app comes back from Android's settings) and the app picker.
 */
const status = computed(() => focus?.device.value ?? null);
onMounted(() => void focus?.readDevice());

const pickerList = ref<FocusList | null>(null);
const apps = ref<InstalledApp[]>([]);
const appsLoading = ref(false);
const appsError = ref("");
const appFilter = ref("");
async function openPicker(list: FocusList): Promise<void> {
  if (!native) return;
  pickerList.value = list;
  appFilter.value = "";
  if (apps.value.length) return;
  appsLoading.value = true;
  appsError.value = "";
  try {
    apps.value = (await native.listInstalledApps()).sort((a, b) =>
      a.label.localeCompare(b.label, "de"),
    );
  } catch {
    appsError.value = "Die Apps auf dem Handy ließen sich nicht lesen.";
  } finally {
    appsLoading.value = false;
  }
}
const shownApps = computed(() => {
  const query = appFilter.value.trim().toLocaleLowerCase("de");
  if (!query) return apps.value;
  return apps.value.filter(
    (app) =>
      app.label.toLocaleLowerCase("de").includes(query) ||
      app.packageName.toLowerCase().includes(query),
  );
});
function listed(list: FocusList, packageName: string): boolean {
  return !!state.value?.lists[list].some(
    (entry) => entry.kind === "app" && entry.value === packageName,
  );
}
async function pick(app: InstalledApp): Promise<void> {
  const list = pickerList.value;
  if (!list || !focus) return;
  await focus.addEntry({
    list,
    kind: "app",
    value: app.packageName,
    label: app.label,
  });
}
</script>

<template>
  <div class="focus-settings">
    <p class="focus-settings__text">
      Während eine Stoppuhr läuft, sperrt die Android-App Apps und Websites,
      die ablenken. Einstellungen und Listen liegen auf deinem Server; nur
      deine Geräte lesen sie.
    </p>

    <template v-if="settings">
      <div class="focus-settings__row">
        <span :id="`${id}-enabled`" class="focus-settings__label">
          Bei der Arbeit sperren
        </span>
        <button
          class="switch"
          type="button"
          role="switch"
          :aria-labelledby="`${id}-enabled`"
          :aria-describedby="`${id}-enabled-text`"
          :aria-checked="settings.enabled"
          :disabled="focus?.busy.value"
          data-test="focus-enabled"
          @click="save({ enabled: !settings.enabled })"
        >
          <span class="switch__track" aria-hidden="true">
            <span class="switch__thumb" />
          </span>
        </button>
      </div>
      <p :id="`${id}-enabled-text`" class="focus-settings__text">
        Gilt für Quests und Dailies auf „Standard“. Im Bearbeiten-Dialog lässt
        sich jede auf „Immer“ oder „Nie“ stellen.
      </p>

      <!-- Switched off, only the switch and its sentence stand; the values wait on the server. -->
      <template v-if="settings.enabled">
        <FocusBlockSetupHint where="settings" />

        <fieldset class="focus-settings__group">
          <legend class="focus-settings__label">Wann gesperrt wird</legend>
          <label
            v-for="trigger in TRIGGERS"
            :key="trigger.value"
            class="focus-settings__choice"
          >
            <input
              type="radio"
              :name="`${id}-trigger`"
              :value="trigger.value"
              :checked="settings.trigger === trigger.value"
              :disabled="focus?.busy.value"
              :data-test="`focus-trigger-${trigger.value}`"
              @change="save({ trigger: trigger.value })"
            />
            <span>
              <strong>{{ trigger.label }}</strong>
              <small>{{ trigger.text }}</small>
            </span>
          </label>
          <template v-if="settings.trigger === 'threshold'">
            <label class="field focus-settings__minutes">
              ab einem Soll von (Minuten)
              <input
                type="number"
                name="focusThreshold"
                min="1"
                max="600"
                step="1"
                inputmode="numeric"
                :value="shownMinutes"
                :aria-invalid="!!minutesError"
                @change="onMinutes"
              />
            </label>
            <p v-if="minutesError" class="form-error" role="alert">
              {{ minutesError }}
            </p>
          </template>
        </fieldset>

        <fieldset class="focus-settings__group">
          <legend class="focus-settings__label">Art der Sperre</legend>
          <div class="segmented" role="radiogroup" aria-label="Art der Sperre">
            <label v-for="mode in MODES" :key="mode.value">
              <input
                type="radio"
                :name="`${id}-mode`"
                :value="mode.value"
                :checked="settings.mode === mode.value"
                :disabled="focus?.busy.value"
                :data-test="`focus-mode-${mode.value}`"
                @change="save({ mode: mode.value })"
              />
              {{ mode.label }}
            </label>
          </div>
          <p class="focus-settings__text">
            <template v-if="settings.mode === 'soft'">
              Soft: Pausierst oder beendest du die Stoppuhr, endet die Sperre;
              beim Fortsetzen beginnt sie neu. Aufheben lässt sie sich jederzeit
              nach der Frage „Sperre aufheben?“.
            </template>
            <template v-else-if="settings.trigger === 'stopwatch'">
              Hardcore: Die Sperre hält auch in Pausen, bis die Quest erledigt
              ist oder du die Stoppuhr beendest. Es gibt keinen Knopf zum
              Aufheben.
            </template>
            <template v-else>
              Hardcore: Die Sperre hält, bis die Quest erledigt ist oder die
              Stoppuhr das Soll erreicht, auch in Pausen und nach dem Beenden. Es
              gibt keinen Knopf zum Aufheben.
            </template>
            Im Fokus-Modus lässt sich die Art vor dem Start mit einem Tipp ändern.
          </p>
        </fieldset>

        <fieldset class="focus-settings__group">
          <legend class="focus-settings__label">Was gesperrt wird</legend>
          <label
            v-for="mode in LIST_MODES"
            :key="mode.value"
            class="focus-settings__choice"
          >
            <input
              type="radio"
              :name="`${id}-list-mode`"
              :value="mode.value"
              :checked="settings.listMode === mode.value"
              :disabled="focus?.busy.value"
              :data-test="`focus-list-mode-${mode.value}`"
              @change="save({ listMode: mode.value })"
            />
            <span>
              <strong>{{ mode.label }}</strong>
              <small>{{ mode.text }}</small>
            </span>
          </label>
          <p class="focus-settings__text">
            Gilt ab der nächsten Sperre; eine laufende behält ihre Art.
          </p>
        </fieldset>

        <p v-if="hardcoreActive" class="focus-settings__note" role="status">
          Eine Hardcore-Sperre läuft: Bis sie endet, lassen sich die Listen nur
          strenger machen.
        </p>

        <section
          v-for="list in LISTS"
          :key="list"
          class="focus-settings__list"
          :aria-labelledby="`${id}-${list}`"
          :data-test="`focus-list-${list}`"
        >
          <h3 :id="`${id}-${list}`" class="focus-settings__list-title">
            {{ LIST_NAMES[list] }}
          </h3>
          <ul class="focus-settings__entries">
            <li
              v-for="entry in state?.lists[list] ?? []"
              :key="entry.id"
              class="focus-settings__entry"
            >
              <span class="focus-settings__entry-text">
                <strong>{{ entryName(entry) }}</strong>
                <small>{{
                  entry.kind === "app"
                    ? `App · ${entry.value}`
                    : "Website mit allen Subdomains"
                }}</small>
              </span>
              <button
                class="btn btn--icon btn--quiet"
                type="button"
                :aria-label="`${entryName(entry)} von der ${LIST_NAMES[list]} nehmen`"
                :disabled="focus?.busy.value || !canRemove()"
                @click="focus?.removeEntry(entry.id)"
              >
                <AppIcon name="trash" />
              </button>
            </li>
            <template v-if="list === 'allow'">
              <li
                v-for="fixed in FIXED_ALLOWED_APPS"
                :key="fixed"
                class="focus-settings__entry focus-settings__entry--fixed"
              >
                <span class="focus-settings__entry-text">
                  <strong>{{ fixed }}</strong>
                  <small>Immer erlaubt</small>
                </span>
              </li>
              <li
                v-for="domain in state?.fixedDomains ?? []"
                :key="domain"
                class="focus-settings__entry focus-settings__entry--fixed"
              >
                <span class="focus-settings__entry-text">
                  <strong>{{ domain }}</strong>
                  <small>Immer erlaubt · Website dieser App</small>
                </span>
              </li>
            </template>
            <li
              v-if="list === 'block' && !state?.lists.block.length"
              class="focus-settings__empty"
            >
              Noch leer.
            </li>
          </ul>
          <form
            class="focus-settings__add"
            @submit.prevent="addDomain(list)"
          >
            <label class="field">
              Website
              <input
                v-model="domains[list]"
                :name="`focus-domain-${list}`"
                type="text"
                inputmode="url"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                :placeholder="list === 'allow' ? 'wikipedia.org' : 'youtube.com'"
                :disabled="!canAdd(list)"
              />
            </label>
            <button
              class="btn btn--ground"
              type="submit"
              :disabled="focus?.busy.value || !canAdd(list) || !domains[list].trim()"
            >
              <AppIcon name="plus" />
              Hinzufügen
            </button>
          </form>
          <button
            v-if="native"
            class="btn btn--ground focus-settings__app"
            type="button"
            :disabled="focus?.busy.value || !canAdd(list)"
            @click="openPicker(list)"
          >
            <AppIcon name="plus" />
            App hinzufügen
          </button>
        </section>

        <!-- A browser cannot block: one honest sentence instead of the device setup. -->
        <p v-if="!native" class="focus-settings__text" data-test="focus-web">
          Gesperrt wird auf dem Android-Handy: Dort richtest du in der App die
          Bedienungshilfe und das VPN ein und wählst Apps für die Listen. Eine
          Stoppuhr, die du hier startest, sperrt dort mit.
        </p>
        <section
          v-else
          class="focus-settings__device"
          :aria-labelledby="`${id}-device`"
          data-test="focus-device"
        >
          <h3 :id="`${id}-device`" class="focus-settings__list-title">
            Auf diesem Gerät
          </h3>
          <ul class="focus-settings__checklist">
            <li class="focus-settings__step">
              <span class="focus-settings__entry-text">
                <strong>Bedienungshilfe aktivieren</strong>
                <small>
                  Damit erkennt die App, welche App gerade vorne ist, und legt bei
                  einer gesperrten ihren Sperrbildschirm darüber. Sie liest keine
                  Inhalte von Bildschirmen. Ist der Schalter ausgegraut (Android 13
                  und neuer): in den App-Infos von Habit Tracker über ⋮
                  „Eingeschränkte Einstellungen zulassen“ tippen, dann noch einmal.
                </small>
                <span class="focus-settings__state">
                  <AppIcon v-if="status?.accessibilityEnabled" name="check" />
                  {{
                    status === null
                      ? "Stand unbekannt"
                      : status.accessibilityEnabled
                        ? "Eingeschaltet"
                        : "Noch aus"
                  }}
                </span>
              </span>
              <button
                class="btn btn--ground"
                type="button"
                @click="focus?.openAccessibilitySettings()"
              >
                Bedienungshilfen öffnen
              </button>
            </li>
            <li class="focus-settings__step">
              <span class="focus-settings__entry-text">
                <strong>VPN für Websites erlauben</strong>
                <small>
                  Android fragt einmal, ob die App ein VPN einrichten darf. Es ist
                  ein lokales VPN nur für die Namensauflösung (DNS) in Browsern:
                  Gesperrte Websites lösen nicht auf, alle anderen Anfragen gehen
                  an den DNS-Server deines Netzes wie bisher. Es läuft nur während
                  einer Sperre, und nichts wird mitgeschnitten.
                </small>
                <span class="focus-settings__state">
                  <AppIcon v-if="status?.vpnPrepared" name="check" />
                  {{
                    status === null
                      ? "Stand unbekannt"
                      : status.vpnPrepared
                        ? "Erlaubt"
                        : "Noch nicht erlaubt"
                  }}
                </span>
              </span>
              <button
                v-if="!status?.vpnPrepared"
                class="btn btn--ground"
                type="button"
                @click="focus?.allowVpn()"
              >
                VPN erlauben
              </button>
            </li>
          </ul>
          <p class="focus-settings__text">
            Ehrlich gesagt: Die Sperre ist eine Hürde gegen Ablenkung, kein Schloss.
            Wer die Bedienungshilfe ausschaltet, das VPN trennt oder die App
            deinstalliert, hebt sie auf, auch im Hardcore-Modus.
          </p>
        </section>
      </template>
    </template>

    <p v-if="focus?.error.value" class="form-error" role="alert">
      {{ focus.error.value }}
    </p>
    <p class="focus-settings__saved" role="status">{{ saved }}</p>

    <ModalDialog
      v-if="pickerList"
      :title="`App zur ${LIST_NAMES[pickerList]}`"
      focus-selector="input[name='focusAppFilter']"
      @close="pickerList = null"
    >
      <label class="field">
        Suchen
        <input
          v-model="appFilter"
          name="focusAppFilter"
          type="search"
          autocomplete="off"
        />
      </label>
      <p v-if="appsLoading" role="status">Apps werden gelesen …</p>
      <p v-if="appsError" class="form-error" role="alert">{{ appsError }}</p>
      <ul class="focus-settings__apps">
        <li v-for="app in shownApps" :key="app.packageName">
          <button
            class="focus-settings__pick"
            type="button"
            :disabled="focus?.busy.value || listed(pickerList, app.packageName)"
            @click="pick(app)"
          >
            <span class="focus-settings__entry-text">
              <strong>{{ app.label }}</strong>
              <small>{{
                listed(pickerList, app.packageName)
                  ? "Schon auf der Liste"
                  : app.packageName
              }}</small>
            </span>
            <AppIcon
              :name="listed(pickerList, app.packageName) ? 'check' : 'plus'"
            />
          </button>
        </li>
      </ul>
    </ModalDialog>
  </div>
</template>

<style scoped>
.focus-settings {
  display: grid;
  gap: var(--space-3);
}

.focus-settings p {
  margin: 0;
}

.focus-settings__text {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.focus-settings__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
}

.focus-settings__label {
  padding: 0;
  font-weight: 700;
}

.focus-settings__minutes {
  justify-self: start;
}

.focus-settings__minutes input {
  width: 8rem;
  font-variant-numeric: tabular-nums;
}

.focus-settings__group {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: var(--space-2) 0 0;
  padding: 0;
  border: 0;
}

.focus-settings__group .segmented {
  justify-self: start;
}

.focus-settings__choice {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-height: var(--tap);
  padding: var(--space-2) 0;
  cursor: pointer;
}

.focus-settings__choice input {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0.125rem 0 0;
  accent-color: var(--color-action);
}

.focus-settings__choice span,
.focus-settings__entry-text {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.focus-settings__choice small,
.focus-settings__entry-text small {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.focus-settings__entry-text strong {
  overflow-wrap: anywhere;
}

.focus-settings__note {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground-deep);
  color: var(--color-ink);
  font-weight: 700;
}

.focus-settings__list,
.focus-settings__device {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.focus-settings__list-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.focus-settings__entries,
.focus-settings__checklist,
.focus-settings__apps {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.focus-settings__entry,
.focus-settings__step {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-line);
}

.focus-settings__step {
  flex-wrap: wrap;
  align-items: flex-start;
}

.focus-settings__entry--fixed strong {
  color: var(--color-ink-muted);
}

.focus-settings__empty {
  padding: var(--space-2) 0;
  color: var(--color-ink-muted);
}

.focus-settings__state {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  margin-top: var(--space-1);
  font-weight: 700;
}

.focus-settings__state :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
}

.focus-settings__add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-end;
}

.focus-settings__add .field {
  flex: 1 1 12rem;
  min-width: 0;
}

.focus-settings__app {
  justify-self: start;
}

.focus-settings__pick {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--tap);
  padding: var(--space-2) var(--space-1);
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.focus-settings__pick:disabled {
  cursor: default;
}

.focus-settings__pick:disabled strong {
  color: var(--color-ink-muted);
}

.focus-settings__pick :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-action-strong);
}

.focus-settings__saved {
  min-height: 1.25rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
