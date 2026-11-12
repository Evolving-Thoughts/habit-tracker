<script setup lang="ts">
import { computed, ref } from "vue";
import {
  login,
  register,
  forgotPassword,
  resendVerification,
  verifyEmail,
  resetPassword,
} from "../api/auth.api";
import type { User } from "../api/auth.api";
import AppIcon from "../components/AppIcon.vue";
const props = defineProps<{
  link?: { kind: "verify" | "reset"; token: string };
}>();
const emit = defineEmits<{ authenticated: [User]; "link-cleared": [] }>();
const mode = ref<
  "login" | "register" | "forgot" | "resend" | "verify" | "reset"
>(props.link?.kind ?? "login");
const email = ref("");
const password = ref("");
const confirmation = ref("");
const pending = ref(false);
const error = ref("");
const message = ref("");
const passwordMode = computed(() =>
  ["login", "register", "reset"].includes(mode.value),
);
const needsNewPassword = computed(() =>
  ["register", "reset"].includes(mode.value),
);
const heading = computed(
  () =>
    ({
      login: "Willkommen zurück",
      register: "Konto erstellen",
      forgot: "Passwort vergessen?",
      resend: "Bestätigung erneut senden",
      verify: "E-Mail bestätigen",
      reset: "Neues Passwort festlegen",
    })[mode.value],
);
const intro = computed(
  () =>
    ({
      login:
        "Schön, dass du da bist. Deine Aufgaben und Gewohnheiten, nur für dich.",
      register:
        "Ein Konto nur für dich. Danach schicken wir dir einen Link zur Bestätigung.",
      forgot:
        "Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.",
      resend: "Wir senden dir den Bestätigungslink noch einmal.",
      verify: "Bestätige deine E-Mail-Adresse mit diesem einmaligen Link.",
      reset: "Wähle ein neues Passwort für dein Konto.",
    })[mode.value],
);
function select(next: typeof mode.value): void {
  if (pending.value) return;
  mode.value = next;
  password.value = "";
  confirmation.value = "";
  error.value = "";
  message.value = "";
  emit("link-cleared");
}
async function submit(): Promise<void> {
  if (pending.value) return;
  error.value = "";
  message.value = "";
  if (
    ["register", "reset"].includes(mode.value) &&
    password.value !== confirmation.value
  ) {
    error.value = "Die Passwörter stimmen nicht überein.";
    return;
  }
  pending.value = true;
  try {
    if (mode.value === "login") {
      emit("authenticated", await login(email.value, password.value));
      password.value = "";
    } else if (mode.value === "register") {
      await register(email.value, password.value);
      selectAfter("resend");
      message.value =
        "Falls die Registrierung möglich war, erhältst du eine E-Mail. Öffne den Bestätigungslink, bevor du dich anmeldest.";
    } else if (mode.value === "forgot") {
      message.value = (await forgotPassword(email.value)).message;
    } else if (mode.value === "resend") {
      message.value = (await resendVerification(email.value)).message;
    } else if (mode.value === "verify" && props.link) {
      await verifyEmail(props.link.token);
      selectAfter("login");
      message.value = "E-Mail bestätigt. Du kannst dich jetzt anmelden.";
    } else if (mode.value === "reset" && props.link) {
      await resetPassword(props.link.token, password.value);
      selectAfter("login");
      message.value =
        "Passwort geändert. Bitte melde dich neu an. Auf allen anderen Geräten bist du jetzt abgemeldet.";
    }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Anfrage fehlgeschlagen.";
  } finally {
    pending.value = false;
  }
}
function selectAfter(next: typeof mode.value): void {
  mode.value = next;
  password.value = "";
  confirmation.value = "";
  emit("link-cleared");
}
</script>
<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="auth-heading">
      <p class="wordmark">
        <span class="wordmark__mark"><AppIcon name="habits" /></span>
        Habit Tracker
      </p>
      <h1 id="auth-heading" class="auth-card__title">{{ heading }}</h1>
      <p class="auth-card__intro">{{ intro }}</p>
      <form class="auth-form" @submit.prevent="submit">
        <fieldset :disabled="pending">
          <label
            v-if="!['verify', 'reset'].includes(mode)"
            class="field"
            for="auth-email"
            >E-Mail-Adresse
            <input
              id="auth-email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              maxlength="254"
              required
            />
          </label>
          <label v-if="passwordMode" class="field" for="auth-password"
            >{{ mode === "reset" ? "Neues Passwort" : "Passwort" }}
            <input
              id="auth-password"
              v-model="password"
              name="password"
              type="password"
              :autocomplete="
                mode === 'login' ? 'current-password' : 'new-password'
              "
              minlength="12"
              maxlength="128"
              required
              :aria-describedby="needsNewPassword ? 'password-help' : undefined"
            />
          </label>
          <p v-if="needsNewPassword" id="password-help" class="auth-form__hint">
            Mindestens 12 Zeichen. Ein langer, einzigartiger Satz eignet sich
            gut.
          </p>
          <label v-if="needsNewPassword" class="field" for="auth-confirm"
            >Passwort wiederholen
            <input
              id="auth-confirm"
              v-model="confirmation"
              name="confirmation"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
            />
          </label>
          <p v-if="error" role="alert" class="form-error auth-form__error">
            {{ error }}
          </p>
          <button class="btn btn--primary auth-form__submit" type="submit">
            {{
              pending
                ? "Bitte warten …"
                : {
                    login: "Anmelden",
                    register: "Registrieren",
                    forgot: "Link senden",
                    resend: "Bestätigungslink senden",
                    verify: "E-Mail bestätigen",
                    reset: "Passwort speichern",
                  }[mode]
            }}
          </button>
        </fieldset>
      </form>
      <p v-if="message" role="status" class="auth-card__message">
        {{ message }}
      </p>
      <div class="auth-links">
        <template v-if="mode === 'login'">
          <button
            class="btn btn--link"
            type="button"
            :disabled="pending"
            @click="select('forgot')"
          >
            Passwort vergessen?
          </button>
          <button
            class="btn btn--link"
            type="button"
            :disabled="pending"
            @click="select('register')"
          >
            Konto erstellen
          </button>
          <button
            class="btn btn--link auth-links__minor"
            type="button"
            :disabled="pending"
            @click="select('resend')"
          >
            Bestätigung erneut senden
          </button>
        </template>
        <template v-else>
          <button
            v-if="mode === 'verify'"
            class="btn btn--link"
            type="button"
            :disabled="pending"
            @click="select('resend')"
          >
            Neuen Bestätigungslink anfordern
          </button>
          <button
            v-if="mode === 'reset'"
            class="btn btn--link"
            type="button"
            :disabled="pending"
            @click="select('forgot')"
          >
            Neuen Link anfordern
          </button>
          <button
            class="btn btn--link"
            type="button"
            :disabled="pending"
            @click="select('login')"
          >
            Zurück zur Anmeldung
          </button>
        </template>
      </div>
    </section>
  </main>
</template>
<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--space-6) var(--space-4);
}
.auth-card {
  width: min(100%, 27rem);
  padding: var(--space-6) var(--space-5) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.wordmark {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: 0 0 var(--space-5);
  color: var(--color-ink);
  font-size: 1.125rem;
  font-weight: 800;
}
.wordmark__mark {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--color-action-tint);
  color: var(--color-ink);
}
.wordmark__mark :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
.auth-card__title {
  margin: 0;
  font-size: clamp(1.5rem, 6vw, 1.875rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.auth-card__intro {
  margin: var(--space-2) 0 var(--space-5);
  color: var(--color-ink-muted);
  text-wrap: pretty;
}
.auth-form fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.auth-form__hint {
  margin: calc(var(--space-2) * -1) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
.auth-form__error {
  overflow-wrap: anywhere;
}
.auth-form__submit {
  width: 100%;
  min-height: 3.25rem;
  margin-top: var(--space-1);
  border-radius: var(--radius-control);
  font-size: 1.0625rem;
}
.auth-card__message {
  margin: var(--space-4) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink);
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.auth-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  justify-content: center;
  margin-top: var(--space-4);
}
.auth-links__minor {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
@media (max-width: 32rem) {
  .auth-page {
    padding: var(--space-4);
  }
  .auth-card {
    padding: var(--space-5) var(--space-4) var(--space-3);
  }
}
</style>
