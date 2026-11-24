# Fokus-Klänge und Töne

Music or ambience plays in the Fokus-Modus while its stopwatch runs
(Fokus-Klänge); short sounds ("Töne") mark "Soll erreicht", every
completion and the milestones, all over the app. The sounds are made with
ElevenLabs and live only on the server: the repository holds code, prompts
and the catalog, never the audio.

Code: `backend/src/sounds/` (catalog and delivery), on the web
`composables/sound-catalog.ts` (the catalog, read once per page),
`composables/useFocusSound.ts` (rules), `utils/sound-loop.ts` (the browser's
loop), `composables/useFocusSoundSettings.ts` (settings),
`composables/useSoundEffects.ts` (the Töne: switch, volume, the one player),
`composables/action-sounds.ts` and `utils/milestones.ts` (which sound an
action gets), `components/SoundEffectSettings.vue` (Einstellungen › Töne),
`components/FocusSoundMenu.vue` (button and panel in the Fokus-Modus),
`components/FocusSoundSettings.vue` (Einstellungen), `components/SoundChoices.vue`
(the choice both share) and `native/focus-sound-plugin.ts`; the Android part
in `frontend/android/app/src/main/java/local/habittracker/app/sound/`.

## When sound plays

- A sound is chosen, the stopwatch of the quest in view runs, and the
  Fokus-Modus is open on this device. On the phone it counts as open while
  the app is in the background, too.
- It starts only from a gesture on this device: Start or Fortsetzen (button
  or Space), choosing a sound while the stopwatch runs, or M. A stopwatch
  started on another device, in Heute, or already running when the
  Fokus-Modus opens stays silent until then. That avoids surprises and the
  browsers' autoplay ban. A Start pressed here counts for the stopwatch that
  starts within 30 seconds (the request, or the question whether another
  stopwatch should end); the go-ahead belongs to that one stopwatch, so
  another one started elsewhere later stays silent.
- Pausing or stopping the stopwatch (anywhere), leaving the Fokus-Modus and
  signing out stop the sound. After a pause it needs a gesture here again.
- The view watches the string `${timer.id}:${timer.state}`, as
  `TimerProvider.vue` does, so the 3-second poll's fresh objects never
  restart anything.
- **"Soll erreicht"** (a Ton, see below): once per stopwatch, when the
  Soll is reached while it runs here after such a gesture (not when it was
  already past its Soll at the start). It sounds without a chosen sound as
  well. "Erledigt" is not the Fokus-Modus' own any more: every completion
  in the app sounds it (below).
- A sound that cannot be loaded, or one the server no longer has, leaves a
  calm line under the bar ("Der Klang konnte nicht geladen werden. Der
  Fokus-Modus läuft ohne ihn weiter.", a status, not an alert) and in the
  panel; the Fokus-Modus works on as before. The next start or choice
  tries again.

## In the Fokus-Modus

The bar holds a sound button next to "Fokus-Modus" (on a phone the label
gives way). While a sound plays it shows a speaker with waves and the
sound's title; otherwise "Klang" with a plain speaker (chosen, silent now)
or a crossed-out one (Aus). So the state is in shape and words, never in
colour alone; `data-sound-state` (`off`, `playing`, `paused`) carries it for
tests. The button opens a small panel: "Aus", then "Musik" and "Geräusche"
as one group of native radios (arrow keys move through all of them), and a
volume slider. Escape or a tap beside it closes the panel; Escape there does
not leave the Fokus-Modus.

**M** switches the sound: while it plays, or while the stopwatch is not
running, M sets it to Aus; otherwise it starts the chosen sound, or brings
back the last one (else the first music). M is a single key, so the switch
in Einstellungen › Tastatur turns it off with the others (`keyboard.md`).

## Settings, per device

Einstellungen › Fokus-Klänge (after Fokus-Sperre): the same choice and the
volume. Without any sound on the server it says "Noch keine Klänge
verfügbar." instead of a list. Everything is stored in `localStorage` under
`focus:sound`:

```json
{ "soundId": "rain", "volume": 0.6, "lastSoundId": "rain" }
```

`soundId` null is Aus; `lastSoundId` is what M brings back. Defaults:
no sound, 60 %. A broken value falls back field by field. There is no
server table: a laptop in the office and the phone at home may want
different sounds. The short sounds have their own section, Töne (below).

## Töne

Short sounds all over the app, independent of the Fokus-Klänge:

| Sound | When |
|---|---|
| `chime-done` "Erledigt" | You tick a Quest or a Daily run in this tab: Heute, Plan, Questlog, Dailies, Kampagnen, Kalender, the stopwatch bar, the Fokus-Modus ("Erledigt" or Ctrl+Enter), X and the command menu. |
| `chime-milestone` | Instead of "Erledigt" (or on its own, after a pause or a logged stretch), when your action reaches a milestone for the first time in its period: the **Wochenziel der Quest-Stunden** (the week's quest minutes reach the overall weekly goal), the **Perfect Week** (every category with a weekly target reached; quests and Daily runs both count), the **Monats-Challenge at 100 %** (every due run done). |
| `chime-reached` "Soll erreicht" | In the Fokus-Modus, see above. |

- Not for opening again (undo included), skipping, or anything that
  arrives from another device by polling: only actions of this tab are
  wrapped (`withActionSound` in `action-sounds.ts`). Every completion runs
  through `writeDone` in `useTicks.ts`, so that one place sounds it; the
  stopwatch's pause, stop and replacing start (`useTimer.ts`) and a
  stretch logged or changed by hand (`WorkLogDialog`, the calendar's drag)
  can sound the quest-hours milestone.
- **Milestones** are judged before and after the action from endpoints the
  app has anyway: `GET /quest-hours?week=` (`questMinutes` against
  `weeklyTargetMinutes`), `GET /week-review?week=` (`perfectWeek.perfect`)
  and `GET /month-challenges` (`current.done` against `current.total`).
  The comparison is pure (`utils/milestones.ts`): below before, at or above
  after, same period. An action never waits for a reading: the "before"
  comes from readings taken ahead — when the app starts and whenever the
  tab shows again (`primeMissingMilestones` in `TimerProvider`), and from
  the read after each action. A reading serves for ten minutes; the quest
  hours read when the own stopwatch starts running serve until it stops,
  since only its stop changes them. Without a reading from before (none
  yet, failed or slower than 1.5 s) only "Erledigt" sounds, and the
  missing kind is read in the background for the next action.
- **Once per period**: `sounds:milestones` in `localStorage` keeps keys like
  `perfect-week:2026-11-23` or `month-challenge:2026-11` (the last 24). A
  milestone found already reached before an action is remembered without a
  sound, so neither a reload nor ticking off again replays it, and its
  kind is not read again in that period.
- **Settings**: Einstellungen › Töne (after Fokus-Klänge): the switch
  "Töne" (on by default) and "Lautstärke der Töne" (60 %); letting go of
  the slider plays a sample. Stored per device under `sounds:effects`:
  `{ "enabled": true, "volume": 0.6 }`. A device that had
  `"chimes": false` under `focus:sound` (the checkbox the switch replaced)
  starts with the switch off. With the switch off nothing is read either.
- **Playback**: one player for all (`playEffect`). In the Android app every
  Ton goes through `FocusSound.chime`, which takes no audio focus, so it
  never stops a playing Fokus-Klang; an `<audio>` in the WebView might take
  it, so the app never uses one for a Ton. In a browser each Ton is its own
  short `<audio>`; its address carries the version, so the browser's cache
  serves the repeats. A Ton missing on the server is skipped silently.
- A sound is never the only cue: every completion and milestone also shows
  in words and shape (the toast, the ticked row, the counters).

## Playback

**Browser.** Two `<audio>` elements take turns: two seconds before the end
of one, the other starts from the top and they cross-fade (a file shorter
than four seconds turns over at its middle). That hides the gap codecs leave
at the end of a file. Web Audio with decoded buffers would loop exactly,
but four minutes of music need about 85 MB decoded. Volume changes apply
live; stopping fades out for half a second; the same sound resumes where it
stopped. A play() the browser refuses for want of a gesture is tolerated.

**Android.** The plugin `FocusSound` hands the sound to a Media3
`MediaSessionService` with ExoPlayer (`REPEAT_MODE_ONE`, foreground type
`mediaPlayback`), so it plays on with the screen off. The service fetches
the file once with the WebView's cookies into the app cache. Its
notification "Fokus-Klang · Titel" has a stop button. When the loop ends
without the page asking (that stop, the media controls, headphones
unplugged, audio focus lost, an error, the app swiped away), the plugin
sends the event `stopped`: the button shows Aus for as long as the view is
open, while the stored choice stays for next time; choosing a sound or M
brings it back. The page calls `play({ id, url, title, volume })`,
`stop()`, `setVolume({ volume })` and `chime({ id, url, volume })` with
absolute URLs. `play` resolves once the loop is ready; the same file again
only changes the volume. A `play` that a later `play` or `stop` replaced is
rejected (code `CANCELLED`, or no code at all), and the page ignores every
rejection but the latest call's. The native path is taken only when the
Android bridge carries the plugin; otherwise the browser's loop plays.

## Catalog and delivery

`backend/src/sounds/sound-catalog.ts` lists every sound with id, title, kind
(`music`, `ambience`, `chime`) and file name:

| Kind | Ids |
|---|---|
| Musik | `lofi-warm`, `lofi-rain-evening`, `piano-calm`, `ambient-drift`, `guitar-soft` |
| Geräusche | `rain`, `cafe`, `forest-stream`, `fireplace` |
| Töne | `chime-reached`, `chime-done`, `chime-milestone` |

- `GET /sounds` (signed in) lists only the entries whose file lies in
  `SOUNDS_DIR` (default `/app/sounds`), each with a `version` for the cache.
  The web reads it once per page and takes titles from it.
- `GET /sounds/:id?v=<version>` (signed in) sends the file: only catalog
  ids, never a path from the request, with Range support and
  `Cache-Control: private, max-age=31536000, immutable`.

## Where the files come from

ElevenLabs (Creator plan): music with Eleven Music, ambience and chimes with
Sound Effects (`loop` for ambience). ElevenLabs' terms do not allow the
files to be published on their own, and the repository is public, so the
audio is **never in git**: `sounds-raw/` and `sounds/` are ignored, and
sharing with the ElevenLabs community stays off.

1. `scripts/sounds/prompts.json` holds the prompt and length per catalog id.
2. `node scripts/sounds/generate.mjs [ids…]` calls the ElevenLabs API with
   the key from `ELEVENLABS_API_KEY` (set in your own terminal) and writes
   `sounds-raw/`. `--takes=N` (1 to 5) makes several variants
   (`<id>.take1.mp3` …) to choose from; copy the one you like to
   `<id>.mp3` before processing. Music the plan's API does not allow can be
   made in the web studio with the same prompts.
3. `scripts/sounds/process.sh [ids…]` (ffmpeg) trims silence, evens out the
   loudness (music −20 LUFS, ambience −23, chimes −18) and writes Opus in
   `.ogg` to `sounds/`.
4. `scripts/sounds/upload.sh` copies `sounds/*.ogg` to the server folder
   that `compose.prod.yaml` mounts read-only (`betrieb.md`). New files show
   up on the next request, no restart.

Tests use tiny self-made silent files in `backend/test/fixtures/sounds/`
(not ElevenLabs material).

## Tests

- `utils/sound-loop.spec.ts`: the turn before the end, short files, the
  fallback on `ended`, the fade on stop, resuming, errors.
- `composables/useFocusSound.spec.ts`: start and stop by the stopwatch key,
  no start without a gesture (nor after it expired, nor for another
  stopwatch), M, "Soll erreicht" once per stopwatch, missing files, the
  plugin's `stopped` event and its replaced `play` calls.
- `composables/useFocusSoundSettings.spec.ts`, `FocusSoundSettings.spec.ts`,
  the sound part of `FocusView.spec.ts` ("Erledigt" through the shared
  completion).
- `composables/useSoundEffects.spec.ts`: the switch, the migration from
  `chimes: false`, browser vs. plugin, silence when off or missing.
  `SoundEffectSettings.spec.ts`: the section.
- `utils/milestones.spec.ts`: each milestone, once per period, nothing
  without a reading from before. `composables/action-sounds.spec.ts`: the
  reads around an action, "Erledigt" vs. the milestone, failures.
  `useTicks.spec.ts` and `useTimer.spec.ts`: which actions sound.
- Specs start with Töne off (`test/setup.ts`), so completions elsewhere
  never reach for the milestone reads.
- `e2e/focus-sound.spec.ts`: pick "Regen", start (`playing`), pause, M,
  leaving stops every audio element; both sections in Einstellungen. It
  follows the player's state rather than audible output.
