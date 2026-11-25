<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/**
 * Heute for a brand-new account, one without any quest or daily yet: what
 * the app's four words mean, a few starters to try and one way to begin.
 * A starter only fills in a title (the quick add for a quest, "Neues Daily"
 * for a daily); nothing is created before the person says so. An account
 * that merely has an empty day keeps the calm line instead.
 */
export type TodayStarter = { kind: "todo" | "habit"; title: string };

const STARTERS: TodayStarter[] = [
  { kind: "habit", title: "Wasser trinken" },
  { kind: "habit", title: "Spazieren gehen" },
  { kind: "todo", title: "Einkaufen" },
];

const TERMS = [
  {
    term: "Quest",
    icon: "check",
    text: "Eine einzelne Aufgabe, einmal zu erledigen. Mit Tag steht sie hier, mit Uhrzeit ist sie ein Termin.",
  },
  {
    term: "Daily",
    icon: "dailies",
    text: "Eine Gewohnheit in deinem Rhythmus, etwa jeden Tag. An jedem fälligen Tag steht ihr Lauf hier.",
  },
  {
    term: "Kampagne",
    icon: "campaigns",
    text: "Ein längerfristiges Ziel. Quests und Dailies, die dazugehören, bringen es voran.",
  },
  {
    term: "Questlog",
    icon: "questlog",
    text: "Offene Quests ohne Tag. Von dort holst du sie auf einen Tag, wenn es passt.",
  },
] as const;

withDefaults(
  defineProps<{
    /** Shows "Erste Quest anlegen"; the split layout has "Neue Quest" in its head. */
    action?: boolean;
    disabled?: boolean;
  }>(),
  { action: true, disabled: false },
);
const emit = defineEmits<{ start: [starter: TodayStarter]; create: [] }>();
</script>

<template>
  <section class="today-welcome" aria-labelledby="today-welcome-title">
    <h2 id="today-welcome-title">Hier steht dein Tag.</h2>
    <p class="today-welcome__lead">
      Was du dir für heute vornimmst, in der Reihenfolge, in der du es angehen
      willst.
    </p>
    <dl class="today-welcome__terms">
      <div v-for="entry in TERMS" :key="entry.term" class="today-welcome__term">
        <dt><AppIcon :name="entry.icon" />{{ entry.term }}</dt>
        <dd>{{ entry.text }}</dd>
      </div>
    </dl>
    <p id="today-welcome-starters" class="today-welcome__try">
      Zum Ausprobieren:
    </p>
    <div
      class="today-welcome__starters"
      role="group"
      aria-labelledby="today-welcome-starters"
    >
      <button
        v-for="starter in STARTERS"
        :key="starter.title"
        class="btn today-welcome__starter"
        type="button"
        :disabled="disabled"
        @click="emit('start', starter)"
      >
        <AppIcon :name="starter.kind === 'habit' ? 'dailies' : 'check'" />
        <span>{{ starter.title }}</span>{{ " " }}<span
          class="today-welcome__kind"
        >{{
          starter.kind === "habit" ? "Daily" : "Quest für heute"
        }}</span>
      </button>
    </div>
    <button
      v-if="action"
      class="btn btn--primary today-welcome__create"
      type="button"
      :disabled="disabled"
      @click="emit('create')"
    >
      <AppIcon name="plus" />Erste Quest anlegen
    </button>
  </section>
</template>

<style scoped>
/* One white card like the calm empty state, but read from the left. */
.today-welcome {
  padding: var(--space-5);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.today-welcome h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  text-wrap: balance;
}

.today-welcome__lead {
  max-width: 60ch;
  margin: var(--space-1) 0 0;
  color: var(--color-ink-muted);
}

/* The four words, each with the icon its view wears in the navigation. */
.today-welcome__terms {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-5) 0 0;
}

.today-welcome__term {
  display: grid;
  gap: 0.125rem;
}

.today-welcome__term dt {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  font-weight: 800;
}

.today-welcome__term dt :deep(svg) {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-ink-muted);
}

.today-welcome__term dd {
  max-width: 60ch;
  margin: 0 0 0 calc(1.125rem + var(--space-2));
  color: var(--color-ink-muted);
}

@media (min-width: 40rem) {
  .today-welcome__terms {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4) var(--space-5);
  }
}

.today-welcome__try {
  margin: var(--space-5) 0 var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.today-welcome__starters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* Which kind a starter becomes, said in words beside its title. */
.today-welcome__kind {
  font-size: 0.8125rem;
  font-weight: 600;
}

.today-welcome__create {
  margin-top: var(--space-5);
}

@media (max-width: 39.99rem) {
  /* On a phone the one way to begin spans the card, under the thumb. */
  .today-welcome__create {
    width: 100%;
  }
}

@media (max-width: 32rem) {
  .today-welcome {
    padding: var(--space-4);
  }
}
</style>
