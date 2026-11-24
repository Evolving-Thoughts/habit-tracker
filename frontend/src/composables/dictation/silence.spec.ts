import { describe, expect, it } from "vitest";
import { SHORT_SILENCE, createSilenceDetector, rms } from "./silence";

describe("end of a short dictation", () => {
  it("ends two seconds after the speech stops", () => {
    const detector = createSilenceDetector(SHORT_SILENCE, 0);
    expect(detector.feed(0.001, 500)).toBe("listening");
    expect(detector.feed(0.2, 1000)).toBe("listening");
    expect(detector.heardSpeech).toBe(true);
    expect(detector.feed(0.005, 2900)).toBe("listening");
    // Speaking again resets the pause.
    expect(detector.feed(0.1, 2950)).toBe("listening");
    expect(detector.feed(0.005, 4900)).toBe("listening");
    expect(detector.feed(0.005, 4950)).toBe("pause");
  });

  it("gives up when nothing is said for eight seconds", () => {
    const detector = createSilenceDetector(SHORT_SILENCE, 1000);
    expect(detector.feed(0.01, 8999)).toBe("listening");
    expect(detector.feed(0.01, 9000)).toBe("nothing-heard");
    expect(detector.heardSpeech).toBe(false);
  });

  it("measures the level as root mean square", () => {
    expect(rms(new Float32Array())).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
