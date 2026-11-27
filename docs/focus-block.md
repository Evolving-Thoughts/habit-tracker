# Fokus-Sperre

While a stopwatch runs, wherever it was started, the Android app blocks
apps and websites that distract. The person decides what with two lists in
Einstellungen, when with a trigger and a per-task choice, and how hard with
Soft or Hardcore. The server holds all of it and starts and ends blocks with
the stopwatch; the phone enforces it. The code lives in `backend/src/focus-blocks/`, the web parts in
`FocusBlockSettings.vue` (Einstellungen), `FocusBlockOverride.vue` (editor),
`FocusBlockSetupHint.vue` (what keeps it from working),
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
  decides first: `never` never blocks, `always` always does (also while
  Einstellungen have it off, and without a Soll). `default` follows
  Einstellungen: `enabled` (default on) and `trigger`:
  - `stopwatch` (default, "Solange die Stoppuhr läuft"): every running
    stopwatch blocks; no Soll needed, no minimum.
  - `threshold` ("Erst ab einem Soll", the earlier rule): only a stopwatch
    whose Soll (`targetMinutes`) is at least `thresholdMinutes` (default
    15) blocks; without a Soll never. Decided: it applies to a stopwatch
    started anywhere, like the default, not only in the Fokus-Modus.
- **One place**: the server ties blocks to the stopwatch's transitions, so
  it does not matter where the stopwatch is started (Heute, Fokus-Modus,
  Plan, Questlog, command menu, a notification, another device). Every
  start, every start on the stopwatch already running and every resume
  (`TimersService.startFocus`) starts a block when the rule says so, in
  the same transaction; every pause and stop runs through
  `recordTransition` (`timers/timer-target.ts`), which calls
  `focusBlockFollowsStopwatch` (`focus-block-store.ts`), the forgotten
  stretch cut and target releases (completion, deletion, skipped run)
  included. The Fokus-Modus only adds the mode picked there
  (`focusBlock: { mode }` on `POST /timers` and `POST /timers/:id/resume`);
  without it the default from Einstellungen applies. "Sperre starten" in
  the Fokus-Modus asks for a block by hand for a running stopwatch
  (`POST /focus-block`, no trigger rule), e.g. after lifting one; it sits
  with the Soft/Hardcore choice and shows only where that choice shows. At most
  one block is open per person; an open one stays as it is.
- **Soft or Hardcore** (`mode`): the default comes from Einstellungen; the
  Fokus-Modus offers both with one tap before the start, but only where a
  block would block something: the Sperrliste is not empty (or strict mode)
  (also in a browser, whose block takes effect on the phone). Otherwise it
  shows one quiet
  line below its buttons instead, no status announcement: "Fokus-Sperre:
  Sperrliste leer · Einrichten" (link to Einstellungen › Fokus-Sperre) or,
  in a browser, "Fokus-Sperre: wirkt auf dem Handy in der Android-App" (the Soft/Hardcore choice stays there, since a block started in the browser takes effect on the phone). The rule
  still starts a block with the stopwatch, in the default mode.
  - Soft holds while the stopwatch runs: pausing ends it (reason
    `paused`), resuming starts a new one, and it ends when the stopwatch
    ends (stop, completion, "Später", switching to another target). By
    hand: "Sperre aufheben" after "Sperre aufheben?"; it stays lifted until
    the next start or resume. With the threshold trigger, leaving the
    Fokus-Modus asks that question first ("Weiter sperren" stays); with the
    stopwatch trigger the block belongs to the stopwatch, so leaving asks
    nothing. A Soft block nobody ends lifts itself after twelve hours.
  - Hardcore with the stopwatch trigger has no `endsAt`: it holds through
    pauses until its quest or run is completed or its stopwatch ends
    (stopped, switched). Without anyone ending it, after twelve hours.
  - Hardcore with the threshold trigger ends at `endsAt`, the moment the
    stopwatch reaches its Soll, computed at the start (`hardcoreEndsAt`:
    start + Soll − time already worked), or when its quest or run is
    completed. Pausing, stopping the stopwatch or changing the Soll later do
    not move it. Without a Soll still ahead such a block starts as Soft,
    and the Fokus screen says so beforehand (`blockShape`).
  - Hardcore has no lift button; `POST /focus-block/end` answers 409
    `HARDCORE_BLOCK`. During Hardcore the lists only get stricter: adding
    to the Sperrliste works, removing from it or adding to the
    Erlaubt-Liste answers 409. The list mode of a block is fixed at its
    start.
- **Time**: ending at `endsAt` needs no worker. Every read closes a block
  past its moment (`openFocusBlock` sets `endedAt = endsAt`, reason
  `target_reached`, or `expired` after twelve hours for a block without
  `endsAt`). `GET /focus-block` reads without the user lock and takes it
  only when it finds such a block to close. Devices count down on the
  server's clock (`serverNow`).

## Data

- `focus_block_settings (userId PK, enabled, trigger stopwatch|threshold,
  thresholdMinutes 1–600, mode, listMode, updatedAt)`; no row means the
  defaults (on, `stopwatch`, 15, Soft, Sperrliste).
- `focus_block_entries (id, userId, list block|allow, kind app|domain,
  value, label, createdAt)`, unique `(userId, list, kind, value)`.
- `focus_blocks (id uuid, userId, todoId, occurrenceId, title, mode,
  listMode, startedAt, endsAt, endedAt, endReason)`; a partial unique index
  keeps one open block (`endedAt IS NULL`) per user. Checks: `endsAt` only
  for Hardcore (Hardcore without it ends with its stopwatch); `endReason`
  exactly when `endedAt` is set, one of `lifted`, `stopwatch_stopped`,
  `paused`, `completed`, `target_reached`, `expired`. A quest completed
  while its stopwatch runs stops the stopwatch first, so a block bound to
  it ends as `stopwatch_stopped`. `title` keeps the quest's name for the
  block screen.
- `todos.focusBlock`, `habits.focusBlock`: `default | always | never`.
- All three tables reference `users` with `ON DELETE CASCADE`; `todoId` and
  `occurrenceId` are `ON DELETE SET NULL` (migration
  `1796600000000-FocusBlocks`).
- Migration `1796800000000-FocusBlockWhileRunning` adds `trigger` (every
  existing row becomes `stopwatch`), makes `enabled` default to true for
  new rows, allows Hardcore without `endsAt` and the reason `paused`.
  Existing rows keep their `enabled`: a row is only written by a change in
  Einstellungen, and it has no creation time, so an untouched "off" cannot
  be told from a chosen one. People without a row get the new defaults.

Writes run in the per-user unit of work. Starting and ending are part of
the change that causes them: the stopwatch's transitions (see Rules › One
place), and `saveQuest` and `HabitSchedulingService.setRunStatus` end the
blocks of what they complete (`focus-block-store.ts`, no Nest
dependencies).

## API

Protected; every answer is the whole state (`FocusBlockStateResponse`):
`{ version, serverNow, settings, block, lists: { block, allow },
fixedDomains }`.

- `GET /focus-block` with `ETag: "<version>"`. `version` hashes everything
  but `serverNow`, so a device polling with `If-None-Match` gets a
  bodiless 304 while nothing changed (Express answers it).
- `PUT /focus-block/settings` with any of `enabled`, `trigger`,
  `thresholdMinutes`, `mode`, `listMode`.
- `POST /focus-block/entries` `{ list, kind, value, label? }` (400 for no
  website or package name); `DELETE /focus-block/entries/:id`.
- `POST /focus-block` `{ mode? }`: a block for the running or paused
  stopwatch (409 `NO_ACTIVE_TIMER` without one).
- `POST /focus-block/end`: lifts Soft; Hardcore 409 `HARDCORE_BLOCK`.
- `POST /timers` and `POST /timers/:id/resume` take `focusBlock: { mode? }`
  (only the mode; whether a block starts does not depend on it).
- `focusBlock` on todos and habits (create, update, responses) and on the
  day planner's items.

## Web

`TimerProvider.vue` holds the state for every view beside the stopwatch
(`createFocusBlockController`). The controller decides itself when it reads
(`startSync` in `useFocusBlock.ts`): on load, whenever the stopwatch's
confirmed state changes (not at its first answer, which the read on load
covers), after target changes, on focus and every 30 seconds, none of these
but the stopwatch while the page is hidden. A read on its way answers every
further trigger; when the stopwatch or a target changed during it, one more
read follows. In the Android app each read also reads the phone's two
permissions (`getStatus`). Einstellungen (`#/einstellungen?abschnitt=fokus-sperre`)
edit it; the editors of quests and dailies carry "Fokus-Sperre: Standard |
Immer | Nie" behind a disclosure that opens by itself when not Standard. The
Fokus-Modus shows "Sperre aktiv · Hardcore · noch 12 Min.", "Sperre aktiv ·
Hardcore" (ends with the stopwatch) or "Sperre aktiv · Soft" and, in a
browser, that blocking happens in the Android app.

**What keeps it from working** (`focusSetupIssues`, shown by
`FocusBlockSetupHint.vue`): an empty Sperrliste in Sperrliste mode (nothing
to block), apps on the list while the accessibility service is off, websites
on the list (or strict mode) without the VPN consent. The hint names it with
the button that fixes it ("Bedienungshilfe einschalten", "VPN erlauben") in
Einstellungen (the empty list there with its sentence only, the list being
right below). The Fokus-Modus shows only the two permissions, compact and
centred below its buttons, without `role="status"`; the empty list is its
quiet line there. The stopwatch bar shows the two permissions in one line
while a block holds.
A person who never filled a list sees no hint in the bar.

In a browser nothing is blocked; a browser extension for the PC is a later
step. Settings and lists live on the server, so Einstellungen edit them on
every device; only picking installed apps and the device setup need the
Android app (where the bridge `focusBlockNative()` exists). A browser shows
one sentence in their place: blocking happens on the Android phone, which is
set up there, and a stopwatch started here blocks there too. Switched off,
the section shows only the switch and its sentence; the trigger (with the
threshold when chosen), the mode, the lists and the device setup appear once
it is on, with their stored values.

## Android

A Capacitor plugin of the app itself (`FocusBlockPlugin`, registered in
`MainActivity`), two services and a block screen. The web layer reaches the
plugin through the bridge Capacitor injects (`window.Capacitor`); the web
build bundles no Capacitor code.

- **Why nothing may block** (owner's report, 2026-11): before the stopwatch
  trigger, only the Fokus-Modus started blocks, the feature was off until
  switched on, and `default` blocked only from a Soll of 15 minutes; a
  stopwatch started on Heute never blocked. On the phone, apps need the
  accessibility service and websites the VPN consent; on Android 13 and
  newer an app installed outside the Play Store must first be allowed
  "Eingeschränkte Einstellungen" in its app info before its accessibility
  service can be switched on. An empty Sperrliste blocks nothing.
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
  läuft: <Quest>", "noch 18 Min. · Hardcore", "Hardcore: bis die Quest
  erledigt ist oder die Stoppuhr endet." or the Soft line, "Zurück zur
  Quest" (opens the app in the Fokus-Modus) and, for Soft only, "Sperre
  aufheben" after "Sperre aufheben?". The phone treats every `hardcore`
  block as not liftable, with or without `endsAt` (`FocusBlockState`). Back leads home. Lifting on the
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

- Backend unit: `focus-block-rules.spec.ts` (both triggers with per-task
  choice, block shape, Hardcore end, 409 on lifting, stricter lists, host
  and package rules).
- Backend e2e: `test/focus-blocks.e2e-spec.ts` (defaults, endpoints, 304,
  a stopwatch started without `focusBlock` and without a Soll, Soft ending
  on pause and starting again on resume, switching targets, Hardcore
  through pauses until the stopwatch ends, the threshold trigger with
  Hardcore until the Soll, completion of a quest or run, by hand).
- Frontend unit: `utils/focus-block.spec.ts` (with `focusSetupIssues`),
  `useFocusBlock.spec.ts`, `FocusBlockSettings.spec.ts` (browser keeps
  the options, setup hint), the editors (`editor-changes.spec.ts`,
  `PlannerItemEditor.spec.ts`) and `FocusView.spec.ts`.
- Playwright: `e2e/focus-block.spec.ts` (Einstellungen in the browser, a
  stopwatch from Heute with pause and resume, editor choice, Fokus-Modus
  with the threshold trigger, Soft and Hardcore).
- Android JVM: `FocusBlockPolicyTest`, `DnsPacketTest`, `UpstreamDnsTest`
  (`cd frontend/android && ./gradlew.bat test`).
