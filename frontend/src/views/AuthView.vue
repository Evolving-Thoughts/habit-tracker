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
        "Passwort geändert. Bitte melde dich erneut an. Alle bisherigen Sessions wurden beendet.";
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
    <p class="eyebrow">HABIT TRACKER</p>
    <section class="auth-card" aria-labelledby="auth-heading">
      <h1 id="auth-heading">{{ heading }}</h1>
      <p class="intro">Deine Aufgaben und Gewohnheiten. Nur für dich.</p>
      <form @submit.prevent="submit">
        <fieldset :disabled="pending">
          <label v-if="!['verify', 'reset'].includes(mode)" for="auth-email"
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
          <label v-if="passwordMode" for="auth-password"
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
              aria-describedby="password-help"
            />
          </label>
          <p v-if="passwordMode" id="password-help" class="hint">
            Mindestens 12 Zeichen. Ein langer, einzigartiger Satz eignet sich
            gut.
          </p>
          <label v-if="['register', 'reset'].includes(mode)" for="auth-confirm"
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
          <p v-if="mode === 'verify'" class="hint">
            Bestätige deine E-Mail-Adresse mit diesem einmaligen Link.
          </p>
          <p v-if="mode === 'forgot'" class="hint">
            Wir senden dir einen Link, mit dem du ein neues Passwort festlegen
            kannst.
          </p>
          <button class="primary" type="submit">
            {{
              pending
                ? "Bitte warten …"
                : {
                    login: "Anmelden",
                    register: "Registrieren",
                    forgot: "Reset-Link senden",
                    resend: "Bestätigungslink senden",
                    verify: "E-Mail bestätigen",
                    reset: "Passwort speichern",
                  }[mode]
            }}
          </button>
        </fieldset>
      </form>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="message" role="status" class="success">{{ message }}</p>
      <div class="auth-links">
        <button
          v-if="mode !== 'login'"
          type="button"
          :disabled="pending"
          @click="select('login')"
        >
          Zur Anmeldung
        </button>
        <template v-else>
          <button type="button" :disabled="pending" @click="select('register')">
            Konto erstellen
          </button>
          <button type="button" :disabled="pending" @click="select('forgot')">
            Passwort vergessen?
          </button>
          <button type="button" :disabled="pending" @click="select('resend')">
            Bestätigung erneut senden
          </button>
        </template>
        <button
          v-if="mode === 'verify'"
          type="button"
          :disabled="pending"
          @click="select('resend')"
        >
          Neuen Bestätigungslink anfordern
        </button>
        <button
          v-if="mode === 'reset'"
          type="button"
          :disabled="pending"
          @click="select('forgot')"
        >
          Neuen Reset-Link anfordern
        </button>
      </div>
    </section>
  </main>
</template>
<style scoped>
.auth-page {
  width: min(100% - 2rem, 28rem);
  margin: 3rem auto;
}
.eyebrow {
  color: #566581;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0 0 1rem;
}
.auth-card {
  background: white;
  padding: 1.5rem;
  border: 1px solid #ccd2dc;
  border-radius: 1rem;
}
h1 {
  margin: 0;
  font-size: 1.75rem;
  line-height: 1.2;
}
.intro,
.hint {
  color: #566581;
  line-height: 1.5;
}
.intro {
  margin: 0.75rem 0 1.5rem;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
label {
  display: block;
  margin-bottom: 1rem;
  font-weight: 600;
}
input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 0.5rem;
  min-height: 3rem;
  padding: 0.7rem;
  font: inherit;
  border: 1px solid #7b8aa3;
  border-radius: 0.5rem;
}
.hint {
  font-size: 0.875rem;
  margin: -0.25rem 0 1rem;
}
button {
  min-height: 2.75rem;
  font: inherit;
  cursor: pointer;
  border-radius: 0.5rem;
}
.primary {
  width: 100%;
  border: 1px solid #2457c5;
  background: #2457c5;
  color: white;
  padding: 0.7rem 1rem;
}
.auth-links {
  border-top: 1px solid #e0e5ed;
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}
.auth-links button {
  background: transparent;
  border: 0;
  color: #2457c5;
  text-align: left;
  padding: 0.5rem 0;
}
.error,
.success {
  padding: 0.75rem;
  border-radius: 0.5rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.error {
  background: #fff0f1;
  color: #a51222;
}
.success {
  background: #edf7f1;
  color: #1e603c;
}
:focus-visible {
  outline: 3px solid #2457c5;
  outline-offset: 3px;
}
button:disabled,
fieldset:disabled {
  opacity: 0.65;
  cursor: wait;
}
@media (max-width: 32rem) {
  .auth-page {
    margin: 1.5rem auto;
  }
  .auth-card {
    padding: 1.25rem;
  }
}
</style>
