import { computed, ref, watch } from "vue";

/**
 * Light or dark, chosen per device in the settings. "system" follows the
 * device live. The resolved theme sits on <html data-theme>, which is all
 * style.css looks at; index.html sets it before the first paint with the
 * same rules, so a reload never flashes the other theme.
 */
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Wie das Gerät" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/* Kept in step with the boot script in index.html; a spec checks both. */
export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
/** The browser bar takes the ground colour (--color-ground of each theme). */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#fde4d0",
  dark: "#1e1611",
};

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export const themeChoice = ref<ThemeChoice>(readChoice());
const systemDark = ref(false);

/** The theme on screen now. */
export const theme = computed<Theme>(() =>
  themeChoice.value === "system"
    ? systemDark.value
      ? "dark"
      : "light"
    : themeChoice.value,
);

export function setThemeChoice(choice: ThemeChoice): void {
  themeChoice.value = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

/** Read again, e.g. after a test changed the storage. */
export function reloadThemeChoice(): void {
  themeChoice.value = readChoice();
}

const media = (query: string): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(query) : null;

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

function apply(next: Theme, fade: boolean): void {
  const root = document.documentElement;
  if (root.dataset.theme === next) return;
  // A short cross-fade on a real switch, never on start or with less motion.
  if (fade && !media("(prefers-reduced-motion: reduce)")?.matches) {
    root.classList.add("theme-fade");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-fade"), 260);
  }
  root.dataset.theme = next;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[next]);
}

let started = false;

/**
 * Starts following the choice and the device, once per page. Applies the
 * theme right away, so tests and the app agree with the boot script.
 */
export function startTheme(): void {
  if (started) {
    apply(theme.value, false);
    return;
  }
  started = true;
  const dark = media(DARK_QUERY);
  systemDark.value = dark?.matches ?? false;
  dark?.addEventListener?.("change", (event) => {
    systemDark.value = event.matches;
  });
  // Another tab of the app changed the choice.
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null)
      reloadThemeChoice();
  });
  apply(theme.value, false);
  watch(theme, (next) => apply(next, true));
}
