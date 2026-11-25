import { createSilenceDetector, rms, type SilenceOptions } from "./silence";

/**
 * The microphone for Whisper in the browser: records with MediaRecorder,
 * watches the level for the end of a short dictation, and turns the result
 * into 16 kHz mono samples, what Whisper reads. Nothing leaves the device.
 */

/** Why the recording ended. */
export type RecordingEnd = "stopped" | "pause" | "nothing-heard" | "limit";

export type RecordingResult = { audio: Blob; end: RecordingEnd };

export type Recording = {
  stop(): void;
  /** Drops everything; `result` resolves to null. */
  cancel(): void;
  result: Promise<RecordingResult | null>;
};

const LEVEL_INTERVAL_MS = 100;

/** Asks for the microphone (rejects as getUserMedia does), then records. */
export async function record(options: {
  maxMs: number;
  silence: SilenceOptions | null;
}): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  let end: RecordingEnd = "stopped";
  let cancelled = false;

  let context: AudioContext | null = null;
  let level: ReturnType<typeof setInterval> | undefined;
  if (options.silence) {
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const detector = createSilenceDetector(options.silence, performance.now());
    level = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const verdict = detector.feed(rms(samples), performance.now());
      if (verdict !== "listening") finish(verdict);
    }, LEVEL_INTERVAL_MS);
  }
  const limit = setTimeout(() => finish("limit"), options.maxMs);

  function release() {
    clearInterval(level);
    clearTimeout(limit);
    stream.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => {});
  }
  function finish(reason: RecordingEnd) {
    if (recorder.state === "inactive") return;
    end = reason;
    recorder.stop();
  }

  const result = new Promise<RecordingResult | null>((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      release();
      resolve(
        cancelled
          ? null
          : { audio: new Blob(chunks, { type: recorder.mimeType }), end },
      );
    };
  });
  recorder.start();
  return {
    stop: () => finish("stopped"),
    cancel: () => {
      cancelled = true;
      if (recorder.state === "inactive") release();
      else recorder.stop();
    },
    result,
  };
}

/** Whisper reads 16 kHz mono; the browser resamples while decoding. */
export const WHISPER_SAMPLE_RATE = 16_000;

export async function toWhisperSamples(audio: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const buffer = await context.decodeAudioData(await audio.arrayBuffer());
    // A copy: the samples are handed over to the worker.
    if (buffer.numberOfChannels === 1)
      return new Float32Array(buffer.getChannelData(0));
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1)
        mono[index] += data[index] / buffer.numberOfChannels;
    }
    return mono;
  } finally {
    void context.close().catch(() => {});
  }
}
