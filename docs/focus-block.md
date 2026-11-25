# Fokus-Sperre

While the Fokus-Modus measures work on one quest or daily run, the Android
app blocks apps and websites that distract. The person decides what with two
lists in Einstellungen, when with a threshold and a per-task choice, and how
hard with Soft or Hardcore. The server holds all of it; the phone enforces
it. The code lives in `backend/src/focus-blocks/`, the web parts in
`FocusBlockSettings.vue` (Einstellungen), `FocusBlockOverride.vue` (editor),
`FocusView.vue` (Fokus-Modus), `composables/useFocusBlock.ts` and
`native/focus-block-plugin.ts`; the Android part in
`frontend/android/app/src/main/java/local/habittracker/app/focus/`.

It is a hurdle against distraction, not a lock. Switching the accessibility
service off, disconnecting the VPN, uninstalling the app or signing out
lifts it, in Hardcore too. There is no device-admin protection (decided).
The UI says so in Einstellungen.

## Rules

- **Lists**: a Sperrliste and an Erlaubt-Liste. An entry is an Android app
  (package name plus the label the phone showed, picked from the installed
  apps in the Android app) or a website, typed and reduced to its host
  (`normalizeDomain`: lower case, no scheme, path, port, leading `www.` or
  `*.`; international names in ASCII). A host covers every subdomain
  (`hostMatches`: `m.youtube.com` ⊂ `youtube.com`, `notyoutube.com` is not).
  At most 200 entries per list and kind; the same entry twice changes
  nothing.
- **List mode** (`listMode`): `blocklist` blocks what is on the Sperrliste;
  `allowlist` (strict) blocks everything except the Erlaubt-Liste.
- **Always allowed**, whatever the lists say (shown as fixed entries in the
  Erlaubt-Liste):
  - apps: this app, the system UI, Settings, every launcher, the default
    dialer and every app that dials, calls and emergency
    (`com.android.phone`, telecom, emergency), the alarm clock, every
    enabled keyboard, Android's permission, package-installer and VPN
    dialogs (`FocusBlockPolicy.ALWAYS_ALLOWED_PACKAGES` plus what
    `FocusBlockController.fixedAllowed` finds on the phone);
  - websites: the app's own host (`fixedDomains`, the host of
    `FRONTEND_URL`, i.e. `plan.evolving-thoughts.com` in production).
    Google Calendar needs nothing here: the sync runs on the server.
- **Trigger** (`blockApplies`): a quest's or daily's own `focusBlock`
  decides: `always` blocks (even without a Soll), `never` never; `default`
  follows Einstellungen: on/off plus "ab Soll von N Min." (`enabled`,
  `thresholdMinutes`, default off and 15). The Soll is the stopwatch's
  `targetMinutes`. Without a Soll, `default` never blocks.
- **Start**: only the Fokus-Modus starts a block. Its "Starten" and
  "Fortsetzen" send `focusBlock: { mode }` with `POST /timers` and
  `POST /timers/:id/resume`; the server starts a block in the same
  transaction when the rule says so. Starting a stopwatch anywhere else
  never blocks. When the Fokus-Modus opens on a stopwatch that already
  runs, "Sperre starten" asks for one by hand (`POST /focus-block`, no
  trigger rule). At most one block is open per person; an open one stays
  as it is.
- **Soft or Hardcore** (`mode`): the default comes from Einstellungen; the
  Fokus-Modus offers both with one tap before the start.
  - Soft ends when the stopwatch ends (stop, completion, "Später",
    switching to another target) and by hand ("Sperre aufheben", after
    "Sperre aufheben?"). Leaving the Fokus-Modus asks that question first;
    "Weiter sperren" stays. Pausing does not end it. A Soft block nobody
    ends lifts itself after twelve hours, like a forgotten stopwatch.
  - Hardcore ends at `endsAt`, the moment the stopwatch reaches its Soll,
    computed at the start (`hardcoreEndsAt`: start + Soll − time already
    worked), or when its quest or run is completed. Pausing, stopping the
    stopwatch or changing the Soll later do not move it. There is no lift
    button; `POST /focus-block/end` answers 409 `HARDCORE_BLOCK`. Without a
    Soll still ahead there is nothing to reach: such a block starts as
    Soft, and the Fokus screen says so beforehand.
  - During Hardcore the lists only get stricter: adding to the Sperrliste
    works, removing from it or adding to the Erlaubt-Liste answers 409.
    The list mode of a block is fixed at its start.
- **Time**: ending at `endsAt` needs no worker. Every read closes a block
  past its moment (`openFocusBlock` sets `endedAt = endsAt`, reason
  `target_reached`, or `expired` for Soft after twelve hours). Devices
  count down on the server's clock (`serverNow`).

## Data

- `focus_block_settings (userId PK, enabled, thresholdMinutes 1–600, mode,
  listMode, updatedAt)`; no row means the defaults.
- `focus_block_entries (id, userId, list block|allow, kind app|domain,
  value, label, createdAt)`, unique `(userId, list, kind, value)`.
- `focus_blocks (id uuid, userId, todoId, occurrenceId, title, mode,
  listMode, startedAt, endsAt, endedAt, endReason)`; a partial unique index
  keeps one open block (`endedAt IS NULL`) per user. Checks: Hardcore
  exactly when `endsAt` is set; `endReason` exactly when `endedAt` is set,
  one of `lifted`, `stopwatch_stopped`, `completed`, `target_reached`,
  `expired`. `title` keeps the quest's name for the block screen.
- `todos.focusBlock`, `habits.focusBlock`: `default | always | never`.
- All three tables reference `users` with `ON DELETE CASCADE`; `todoId` and
  `occurrenceId` are `ON DELETE SET NULL` (migration
  `1796600000000-FocusBlocks`).

Writes run in the per-user unit of work. Ending is part of the change that
causes it: `stopTimer` (`timers/timer-target.ts`) ends Soft blocks,
`saveQuest` and `HabitSchedulingService.setRunStatus` end the blocks of what
they complete (`focus-block-store.ts`, no Nest dependencies).

## API

Protected; every answer is the whole state (`FocusBlockStateResponse`):
`{ version, serverNow, settings, block, lists: { block, allow },
fixedDomains }`.

- `GET /focus-block` with `ETag: "<version>"`. `version` hashes everything
  but `serverNow`, so a device polling with `If-None-Match` gets a
  bodiless 304 while nothing changed (Express answers it).
- `PUT /focus-block/settings` with any of `enabled`, `thresholdMinutes`,
  `mode`, `listMode`.
- `POST /focus-block/entries` `{ list, kind, value, label? }` (400 for no
  website or package name); `DELETE /focus-block/entries/:id`.
- `POST /focus-block` `{ mode? }`: a block for the running or paused
  stopwatch (409 `NO_ACTIVE_TIMER` without one).
- `POST /focus-block/end`: lifts Soft; Hardcore 409 `HARDCORE_BLOCK`.
- `POST /timers` and `POST /timers/:id/resume` take `focusBlock: { mode? }`.
- `focusBlock` on todos and habits (create, update, responses) and on the
  day planner's items.

## Web

`TimerProvider.vue` holds the state for every view beside the stopwatch
(`createFocusBlockController`): it reads it on load, whenever the stopwatch
changes, after target changes, on focus and every 30 seconds. Einstellungen
(`#/einstellungen?abschnitt=fokus-sperre`) edit it; the editors of quests
and dailies carry "Fokus-Sperre: Standard | Immer | Nie" behind a
disclosure that opens by itself when not Standard. The Fokus-Modus shows
"Sperre aktiv · Hardcore · noch 12 Min." or "Sperre aktiv · Soft" and, in a
browser, that blocking happens in the Android app.

In a browser nothing is blocked; a browser extension for the PC is a later
step.

## Android

A Capacitor plugin of the app itself (`FocusBlockPlugin`, registered in
`MainActivity`), two services and a block screen. The web layer reaches the
plugin through the bridge Capacitor injects (`window.Capacitor`); the web
build bundles no Capacitor code.

- **Plugin API**: `getStatus()` (`accessibilityEnabled`, `vpnPrepared`),
  `openAccessibilitySettings()`, `requestVpnPermission()` (Android's VPN
  consent dialog), `listInstalledApps()` (apps with a launcher icon, label
  and package), `setBlock({ state, pollUrl, endUrl, origin } | { state:
  null })`, and the event `openFocus` ("Zurück zur Quest").
- **State sync**: every server answer the page reads goes to `setBlock`;
  the plugin stores it in SharedPreferences (`FocusBlockStore`) with the
  clock difference to the server and the addresses of the API. From then
  on the phone needs no page: while the accessibility service or the VPN
  runs, `FocusBlockSync` polls `GET /api/focus-block` with the WebView's
  session cookie (`CookieManager`) and `If-None-Match`, every 30 seconds
  during a block and every 60 seconds otherwise, so a block started on the
  PC reaches the phone within a minute. A block ends on the phone by
  itself at its moment, without a connection. After a restart of a
  service the stored state applies at once. Signing out clears it.
- **Apps**: `FocusAccessibilityService` gets only
  `TYPE_WINDOW_STATE_CHANGED` with the package name
  (`canRetrieveWindowContent="false"`, no key events, no gestures). During
  a block it opens `BlockActivity` over an app the block covers: "Fokus
  läuft: <Quest>", "noch 18 Min. · Hardcore" or the Soft line, "Zurück zur
  Quest" (opens the app in the Fokus-Modus) and, for Soft only, "Sperre
  aufheben" after "Sperre aufheben?". Back leads home. Lifting on the
  phone holds there at once and reaches the server with `POST
  /api/focus-block/end` (Origin and JSON as the server requires), later if
  offline.
- **Websites**: `FocusVpnService` is a local VPN for DNS only. It routes
  one made-up address (`10.111.222.2/32`) into the app and names it as DNS
  server; no other packet enters it. It covers only the browsers on the
  phone (apps that open any web link), so messengers, calls and the
  system keep their names. A lookup of a blocked host gets NXDOMAIN
  (`DnsPacket`); every other lookup is forwarded unchanged to the DNS
  server of the current network, as before, and the answer handed back.
  Nothing is logged or stored. The servers are read again on every network
  change (a `NetworkCallback`: the default network from Android 7 on, any
  non-VPN network with internet on Android 6), so moving from Wi-Fi to
  mobile data keeps names working; `UpstreamDns` picks them (non-VPN
  networks with internet, IPv4 first, each once). Only if the network names
  no DNS server, lookups go to Quad9 (`9.9.9.9`), run by a non-profit that
  by its policy logs no IP addresses; it sees names, never content. It
  runs only while a block that covers websites holds (Sperrliste with
  websites, or strict mode) and the VPN consent is given, with a quiet
  notification "Fokus-Sperre aktiv". Android shows its key symbol
  meanwhile.
- **Limits** (honest): "Private DNS" set to a hostname in Android's
  settings, or a browser with its own secure DNS (DNS over HTTPS), bypasses
  the website filter. In-app browsers of other apps are not covered (block
  those apps instead). A site already resolved may stay reachable for a
  short while (DNS caches). Android may refuse to start the VPN from the
  background; it then starts the next time the app comes to the front.
  Without the accessibility service apps are not blocked; without the
  consent websites are not.
- **Manifest**: `ACCESS_NETWORK_STATE`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_SPECIAL_USE` (the VPN's notification, type
  `specialUse`), `<queries>` for launcher apps, launchers, dialers and
  browsers instead of `QUERY_ALL_PACKAGES`; the accessibility service with
  `BIND_ACCESSIBILITY_SERVICE` and `res/xml/focus_accessibility_service.xml`;
  the VPN service with `BIND_VPN_SERVICE`; `BlockActivity` in a task of its
  own, not in Recents.

## Privacy

The lists and blocks stay on the person's server and go only to their own
signed-in devices. The phone sends nothing but the two requests above to
that server. The accessibility service sees package names, never content.
The VPN sees DNS questions of browsers only and answers or forwards them
without keeping them. No telemetry, no third party.

## Tests

- Backend unit: `focus-block-rules.spec.ts` (trigger with per-task choice,
  Hardcore end, 409 on early lifting, stricter lists, host and package
  rules).
- Backend e2e: `test/focus-blocks.e2e-spec.ts` (endpoints, 304, timer
  start and resume, Soft ending with the stopwatch, Hardcore through pause
  and stop, ending at the Soll and by completion of a quest or run).
- Frontend unit: `utils/focus-block.spec.ts`, `useFocusBlock.spec.ts`,
  `FocusBlockSettings.spec.ts`, the editors (`editor-changes.spec.ts`,
  `PlannerItemEditor.spec.ts`) and `FocusView.spec.ts`.
- Playwright: `e2e/focus-block.spec.ts` (Einstellungen, editor choice,
  Fokus-Modus with Soft and Hardcore).
- Android JVM: `FocusBlockPolicyTest`, `DnsPacketTest`, `UpstreamDnsTest`
  (`cd frontend/android && ./gradlew.bat test`).
