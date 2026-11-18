# Theme: light and dark

The app has a light theme (warm apricot) and a dark one (warm umber). Both
use the same colour roles; the palette and the rules are in `DESIGN.md`
(Colors › Dunkel). This page is about the mechanism.

## Tokens

Every colour, shadow and scrim is a custom property in
`frontend/src/style.css`:

- `:root { … }` holds the light values and `color-scheme: light`.
- `:root[data-theme="dark"] { … }` redefines the same names for dark and sets
  `color-scheme: dark`, so native controls, scrollbars and autofill follow.

Components only ever use `var(--color-…)` and `var(--shadow-…)`. Two specs
keep it that way:

- `src/color-literals.spec.ts` fails on a hex, `rgb()`/`hsl()` or
  `white`/`black` colour in any `.vue` file or in `style.css` outside the two
  token blocks. Its allow-list is empty.
- `src/theme.spec.ts` parses both token sets (`src/utils/contrast.ts`) and
  checks WCAG contrast for the pairs the app draws: text 4.5:1; marks, rings,
  icons on badges, field borders and the focus ring 3:1. Translucent surfaces
  are flattened onto the ground first. It also checks that the dark block
  redefines every colour and shadow token.

A new colour therefore needs a light value, a dark value and, if it carries
text or meaning, a pair in `theme.spec.ts`.

## One attribute, one dark block

The CSS knows only `data-theme="light" | "dark"` on `<html>`; there is no
`@media (prefers-color-scheme)` block. JavaScript always writes the resolved
theme, so the dark values exist exactly once.

`src/composables/useTheme.ts`:

- `themeChoice`: `"system" | "light" | "dark"`, stored per device in
  `localStorage["theme"]`. "system" is the default and removes the key.
- `theme`: the resolved theme. "system" follows
  `matchMedia("(prefers-color-scheme: dark)")` live, including a change while
  the app is open (an evening switch on the phone).
- `startTheme()` (called once in `main.ts`) writes `data-theme`, sets
  `<meta name="theme-color">` to the ground of the theme and follows changes,
  also from another tab (`storage` event).
- On a real switch it adds `theme-fade` to `<html>` for 260ms, which
  cross-fades colours for 200ms. With `prefers-reduced-motion: reduce` it
  does not, and the CSS rule only exists under
  `prefers-reduced-motion: no-preference`.

The choice is made in Einstellungen › Darstellung (`ThemeSetting.vue`, a
radio group in the segmented look) or in the command menu ("Darstellung:
Dunkel", "Darstellung: Hell", "Darstellung: Wie das Gerät"; the current one
is left out).

## No flash on load

`frontend/index.html` has a small classic inline script in `<head>`, before
the app's module script and stylesheet. It reads the stored choice and the
media query and sets `data-theme` and the `theme-color` meta before the first
paint. It repeats the composable's few lines on purpose: the module is not
loaded yet. `useTheme.spec.ts` runs the script from `index.html` against the
same cases as the composable, and `theme.spec.ts` checks that its colours
match `--color-ground` of each theme. `e2e/theme.spec.ts` holds the app's
script back on reload and checks that the page is already dark before the
app mounts.

Content-Security-Policy: there is none today. Neither nginx
(`frontend/nginx.conf`), the local gateway (`frontend/scripts/tunnel-server.mjs`)
nor the backend sends one. If one is added, the inline script needs a hash
(`script-src 'sha256-…'`) or must move to a tiny external file loaded
synchronously in `<head>`.

## Colours outside the page

- `<meta name="theme-color">`: the ground, `#fde4d0` light and `#1e1611`
  dark. The old value was a leftover blue.
- `public/manifest.webmanifest`: `theme_color` and `background_color` are the
  light ground. A manifest cannot follow the theme; the meta tag overrides
  `theme_color` while the app runs. The icons are still the old blue square.
- Capacitor: the project configures no status bar plugin, and none was added.
  The Android activity uses a DayNight theme, so the WebView's
  `prefers-color-scheme` follows the system, which is what "Wie das Gerät"
  needs.
