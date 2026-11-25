import { readonly, ref } from "vue";
import {
  speechNative,
  type SpeechUnavailableReason,
} from "../../native/speech-plugin";
import {
  MICROPHONE_DENIED,
  NOTHING_HEARD,
  RECOGNITION_FAILED,
  START_FAILED,
  type DictationEngine,
  type DictationSetup,
} from "./engine";

/**
 * The phone's own recogniser through the Android plugin `Speech`, on the
 * device only. Without the German offline model it is still offered, but a
 * tap explains how to get the model instead of listening (`setup`).
 */

const STEPS = [
  "Öffne die Einstellungen des Geräts.",
  "Such nach „Spracherkennung auf dem Gerät“ oder „Offline-Spracherkennung“. Je nach Gerät liegt sie unter System › Sprache oder in den Einstellungen der Google-App unter Sprache.",
  "Lade dort Deutsch herunter und tipp danach noch einmal aufs Mikrofon.",
];

function setupFor(reason: SpeechUnavailableReason): DictationSetup {
  if (reason === "offline-model-downloading")
    return {
      message:
        "Das deutsche Offline-Sprachpaket wird gerade geladen. Danach geht das Diktieren ohne Internet.",
      steps: [
        "Warte, bis der Download fertig ist, und tipp dann noch einmal aufs Mikrofon.",
      ],
    };
  return {
    message:
      "Zum Diktieren braucht dieses Gerät das deutsche Offline-Sprachpaket. Dann bleibt die Aufnahme auf dem Gerät.",
    steps: STEPS,
    action: {
      label: "Sprachpaket einrichten",
      run: async () => {
        const native = speechNative();
        const action = native ? await native.openOfflineSetup() : "none";
        // Ask again on the next tap: the pack may be there by then.
        check = null;
        if (action === "download")
          return "Android lädt das deutsche Sprachpaket. Wenn es fertig ist, tipp noch einmal aufs Mikrofon.";
        if (action === "none")
          return "Die Einstellungen ließen sich nicht öffnen. Such die Offline-Spracherkennung bitte von Hand.";
        return null;
      },
    },
  };
}

const supported = ref<boolean | null>(null);
const setup = ref<DictationSetup | null>(null);
let check: Promise<void> | null = null;

export const nativeEngine: DictationEngine = {
  id: "native",
  supported: readonly(supported),
  setup: readonly(setup),

  detect() {
    if (check) return check;
    const native = speechNative();
    check = native
      ? native.status().then(
          (status) => {
            // Offered while only the offline pack is missing: a tap explains.
            supported.value =
              status.available || status.reason !== "unavailable";
            setup.value =
              status.reason && status.reason !== "unavailable"
                ? setupFor(status.reason)
                : null;
            // Not ready yet: ask again next time.
            if (setup.value) check = null;
          },
          () => {
            supported.value = false;
            setup.value = null;
          },
        )
      : Promise.resolve().then(() => {
          supported.value = false;
        });
    return check;
  },

  start(_mode, handlers) {
    const native = speechNative()!;
    let heard = "";
    let over = false;
    const fail = (code: unknown, message?: string) => {
      over = true;
      release();
      if (code === "offline-model-missing") {
        setup.value = setupFor("offline-model-missing");
        check = null;
      }
      handlers.failed(
        code === "permission"
          ? MICROPHONE_DENIED
          : code === "no-match" || code === "speech-timeout"
            ? NOTHING_HEARD
            : message || RECOGNITION_FAILED,
      );
    };
    const offs = [
      native.onPartial(({ text }) => handlers.partial(text)),
      native.onFinal(({ text }) => (heard = text)),
      native.onError(({ code, message }) => fail(code, message)),
      native.onEnd(() => {
        release();
        if (!over) handlers.done(heard);
      }),
    ];
    function release() {
      offs.splice(0).forEach((off) => off());
    }
    native.start({ partial: true }).then(
      () => {
        if (!over) handlers.listening();
      },
      (error: unknown) => {
        const { code, message } = (error ?? {}) as {
          code?: unknown;
          message?: string;
        };
        fail(code, code === "offline-model-missing" ? message : START_FAILED);
      },
    );
    return {
      stop: () => void native.stop().catch(() => {}),
      cancel: () => {
        over = true;
        release();
        void native.cancel().catch(() => {});
        handlers.cancelled();
      },
    };
  },

  reset() {
    supported.value = null;
    setup.value = null;
    check = null;
  },
};
