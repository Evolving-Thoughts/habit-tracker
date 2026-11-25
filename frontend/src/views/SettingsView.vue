<script setup lang="ts">
import { computed, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import CalendarConnection from "../components/CalendarConnection.vue";
import CategorySettings from "../components/CategorySettings.vue";
import DayBestSetting from "../components/DayBestSetting.vue";
import FocusBlockSettings from "../components/FocusBlockSettings.vue";
import FocusSoundSettings from "../components/FocusSoundSettings.vue";
import PushSettings from "../components/PushSettings.vue";
import QuestTargetSetting from "../components/QuestTargetSetting.vue";
import ShortcutSettings from "../components/ShortcutSettings.vue";
import SoundEffectSettings from "../components/SoundEffectSettings.vue";
import ThemeSetting from "../components/ThemeSetting.vue";
import VoiceInputSettings from "../components/VoiceInputSettings.vue";
import { useKeyboardLikely } from "../composables/useShortcuts";
import { useMediaQuery } from "../composables/useMediaQuery";
import { hrefOf, SECTION_QUERY, sectionId } from "../routes";

defineProps<{ email: string }>();
defineEmits<{ signOut: [] }>();
// Only where a keyboard is likely; a phone has no keys to switch off.
const keyboardLikely = useKeyboardLikely();

/*
 * The jump list on top: every section by a short name, in the page's
 * order. A tap scrolls to the section and puts the focus on its title,
 * the same as opening it by address (?abschnitt=…).
 */
const SECTIONS = [
  { name: "wochenziel", label: "Wochenziel" },
  { name: "kategorien", label: "Kategorien" },
  { name: "darstellung", label: "Darstellung" },
  { name: "das-beste", label: "Das Beste" },
  { name: "fokus-sperre", label: "Fokus-Sperre" },
  { name: "fokus-klaenge", label: "Fokus-Klänge" },
  { name: "toene", label: "Töne" },
  { name: "spracheingabe", label: "Spracheingabe" },
  { name: "benachrichtigungen", label: "Benachrichtigungen" },
  { name: "google-kalender", label: "Google Kalender" },
  { name: "tastatur", label: "Tastatur" },
  { name: "konto", label: "Konto" },
] as const;
const jumps = computed(() =>
  SECTIONS.filter(
    (section) => section.name !== "tastatur" || keyboardLikely.value,
  ),
);
const sectionHref = (name: string) =>
  `${hrefOf("settings")}?${SECTION_QUERY}=${name}`;
const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

function focusTitle(name: string): HTMLElement | null {
  const title = document.querySelector<HTMLElement>(`#${sectionId(name)} h2`);
  if (!title) return null;
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
  return title;
}
function jump(name: string): void {
  const section = document.getElementById(sectionId(name));
  if (!section) return;
  section.scrollIntoView?.({
    behavior: reducedMotion.value ? "auto" : "smooth",
    block: "start",
  });
  focusTitle(name);
}

/*
 * "?abschnitt=kategorien" (also where #/kategorien leads): the router scrolls
 * to the section, the keyboard and screen reader start at its title.
 */
const route = useRoute();
watch(
  () => route.query[SECTION_QUERY],
  async (name) => {
    if (typeof name !== "string") return;
    await nextTick();
    focusTitle(name);
  },
  { immediate: true },
);
</script>

<template>
  <main class="page settings-view">
    <header class="page-header">
      <h1 class="page-title">Einstellungen</h1>
    </header>

    <nav class="settings-view__jump" aria-label="Abschnitte der Einstellungen">
      <ul class="settings-view__chips">
        <li v-for="section in jumps" :key="section.name">
          <a
            class="chip settings-view__chip"
            :href="sectionHref(section.name)"
            @click.prevent="jump(section.name)"
            >{{ section.label }}</a
          >
        </li>
      </ul>
    </nav>

    <div class="settings-view__sections">
      <section
        :id="sectionId('wochenziel')"
        class="card"
        aria-labelledby="settings-quest-hours"
      >
        <h2 id="settings-quest-hours" class="section-title">
          Wochenziel Kampagnen-Stunden
        </h2>
        <QuestTargetSetting />
      </section>

      <section
        :id="sectionId('kategorien')"
        class="card"
        aria-labelledby="settings-categories"
      >
        <h2 id="settings-categories" class="section-title">Kategorien</h2>
        <CategorySettings />
      </section>

      <section
        :id="sectionId('darstellung')"
        class="card"
        aria-labelledby="settings-theme"
      >
        <h2 id="settings-theme" class="section-title">Darstellung</h2>
        <ThemeSetting />
      </section>

      <section
        :id="sectionId('das-beste')"
        class="card"
        aria-labelledby="settings-day-best"
      >
        <h2 id="settings-day-best" class="section-title">
          Das Beste des Tages
        </h2>
        <DayBestSetting />
      </section>

      <section
        :id="sectionId('fokus-sperre')"
        class="card"
        aria-labelledby="settings-focus-block"
      >
        <h2 id="settings-focus-block" class="section-title">Fokus-Sperre</h2>
        <FocusBlockSettings />
      </section>

      <section
        :id="sectionId('fokus-klaenge')"
        class="card"
        aria-labelledby="settings-focus-sound"
      >
        <h2 id="settings-focus-sound" class="section-title">Fokus-Klänge</h2>
        <FocusSoundSettings />
      </section>

      <section
        :id="sectionId('toene')"
        class="card"
        aria-labelledby="settings-sound-effects"
      >
        <h2 id="settings-sound-effects" class="section-title">Töne</h2>
        <SoundEffectSettings />
      </section>

      <section
        :id="sectionId('spracheingabe')"
        class="card"
        aria-labelledby="settings-voice-input"
      >
        <h2 id="settings-voice-input" class="section-title">Spracheingabe</h2>
        <VoiceInputSettings />
      </section>

      <section
        :id="sectionId('benachrichtigungen')"
        class="card"
        aria-labelledby="settings-push"
      >
        <h2 id="settings-push" class="section-title">Benachrichtigungen</h2>
        <PushSettings />
      </section>

      <section
        :id="sectionId('google-kalender')"
        class="card"
        aria-labelledby="settings-calendar"
      >
        <h2 id="settings-calendar" class="section-title">Google Kalender</h2>
        <CalendarConnection />
      </section>

      <section
        v-if="keyboardLikely"
        :id="sectionId('tastatur')"
        class="card"
        aria-labelledby="settings-shortcuts"
      >
        <h2 id="settings-shortcuts" class="section-title">Tastatur</h2>
        <ShortcutSettings />
      </section>

      <section
        :id="sectionId('konto')"
        class="card"
        aria-labelledby="settings-account"
      >
        <h2 id="settings-account" class="section-title">Konto</h2>
        <div class="settings-view__account">
          <p class="settings-view__email">
            Angemeldet als <strong>{{ email }}</strong>
          </p>
          <button
            class="btn btn--quiet"
            type="button"
            @click="$emit('signOut')"
          >
            <AppIcon name="logout" />
            Abmelden
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings-view__sections {
  display: grid;
  gap: var(--space-3);
}

/*
 * The jump list: filter chips as links. A phone keeps them on one line that
 * scrolls sideways in itself; wider, they wrap.
 */
.settings-view__jump {
  margin: calc(var(--space-2) - var(--space-5)) -1rem var(--space-4);
}

.settings-view__chips {
  display: flex;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-1) 1rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  list-style: none;
  scrollbar-width: none;
}

.settings-view__chips > li {
  flex: none;
}

.settings-view__chip {
  display: inline-flex;
  align-items: center;
  font-size: 0.9375rem;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 420ms var(--spring);
}

.settings-view__chip:hover {
  border-color: var(--color-line-strong);
  color: var(--color-ink);
}

.settings-view__chip:active {
  transform: var(--press);
  transition-duration: 90ms;
}

@media (min-width: 40rem) {
  .settings-view__jump {
    margin-inline: 0;
  }

  .settings-view__chips {
    flex-wrap: wrap;
    padding-inline: 0;
    overflow: visible;
  }
}

.settings-view__sections > .card {
  padding: var(--space-5);
  /*
   * A section opened by address or the jump list stops a little below the
   * page's top. On a phone the stopwatch bar sits at the bottom, over the
   * tab bar, so only the top's safe area counts here.
   */
  scroll-margin-top: calc(env(safe-area-inset-top, 0px) + var(--space-4));
  scroll-margin-bottom: calc(
    var(--tab-bar-height) + var(--timer-bar-height) + var(--space-4)
  );
}

.settings-view .section-title {
  margin: 0 0 var(--space-3);
}

/* Its title takes the focus when the section is opened by address. */
.settings-view .section-title:focus {
  outline: none;
}

.settings-view__account {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
  justify-content: space-between;
}

.settings-view__email {
  margin: 0;
  min-width: 0;
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
}

.settings-view__email strong {
  color: var(--color-ink);
  font-weight: 700;
}

/* The quiet button sits at the card's edge; pull it in line with the text. */
.settings-view__account .btn {
  margin-inline-end: calc(var(--space-2) * -1);
}

@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  /* Clear of the top bar of wide screens and mouse windows. */
  .settings-view__sections > .card {
    scroll-margin-top: calc(
      3.5rem + env(safe-area-inset-top, 0px) + var(--space-4)
    );
  }
}

@media (max-width: 32rem) {
  .settings-view__sections > .card {
    padding: var(--space-4);
  }
}
</style>
