import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveWeekReview } from "../api/week-review.api";
import { MicStub, dictate } from "../test/mic-stub";
import { MONDAY } from "../test/week-review-fixtures";
import type { WeekReviewAnswers } from "../types/week-review";
import ReviewAnswers from "./ReviewAnswers.vue";

vi.mock("../api/week-review.api", () => ({ saveWeekReview: vi.fn() }));

enableAutoUnmount(afterEach);

const EMPTY: WeekReviewAnswers = {
  wentWell: null,
  wentBadly: null,
  changeNext: null,
};

function mountAnswers(answers = EMPTY, ahead = false) {
  return mount(ReviewAnswers, {
    props: { week: MONDAY, answers, ahead },
  });
}

describe("ReviewAnswers", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  const field = (wrapper: ReturnType<typeof mountAnswers>, name: string) =>
    wrapper.get(`[name="${name}"]`).element as HTMLTextAreaElement;

  it("asks the three questions and shows the stored answers, with no save button", () => {
    const wrapper = mountAnswers({ ...EMPTY, wentWell: "Drei Kapitel" });
    expect(wrapper.findAll("label").map((label) => label.text())).toEqual([
      "Was lief gut?",
      "Was lief nicht gut?",
      "Was ändere ich?",
    ]);
    expect(field(wrapper, "wentWell").value).toBe("Drei Kapitel");
    // The answers save themselves; nothing to press, nothing said yet.
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toBe("");
  });

  it("saves by itself after a short pause, then says so quietly", async () => {
    vi.useFakeTimers();
    vi.mocked(saveWeekReview).mockResolvedValue({
      ...EMPTY,
      changeNext: "Früher anfangen",
    });
    const wrapper = mountAnswers();
    await wrapper.get('[name="changeNext"]').setValue("Früher anfangen ");
    expect(wrapper.get('[role="status"]').text()).toBe("Speichert …");
    expect(saveWeekReview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();

    expect(saveWeekReview).toHaveBeenCalledTimes(1);
    expect(saveWeekReview).toHaveBeenCalledWith(MONDAY, {
      wentWell: "",
      wentBadly: "",
      changeNext: "Früher anfangen ",
    });
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert");
    expect(wrapper.emitted("saved")).toEqual([
      [{ ...EMPTY, changeNext: "Früher anfangen" }],
    ]);
    // The stored answer comes back trimmed; the field keeps what is typed.
    await wrapper.setProps({ answers: { ...EMPTY, changeNext: "Früher anfangen" } });
    expect(field(wrapper, "changeNext").value).toBe("Früher anfangen ");
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveWeekReview).toHaveBeenCalledTimes(1);
  });

  it("sends what is typed right away when the field is left", async () => {
    vi.mocked(saveWeekReview).mockResolvedValue({ ...EMPTY, wentWell: "Gut" });
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentWell"]').setValue("Gut");
    await wrapper.get('[name="wentWell"]').trigger("blur");
    await flushPromises();
    expect(saveWeekReview).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert");
  });

  it("saves what was typed for a week to that week when another one opens", async () => {
    const NEXT = "2026-11-23";
    vi.mocked(saveWeekReview).mockResolvedValue({ ...EMPTY, wentWell: "Alt" });
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentWell"]').setValue("Alt");
    await wrapper.setProps({ week: NEXT, answers: { ...EMPTY } });
    await flushPromises();
    expect(saveWeekReview).toHaveBeenCalledWith(MONDAY, {
      wentWell: "Alt",
      wentBadly: "",
      changeNext: "",
    });
    expect(field(wrapper, "wentWell").value).toBe("");
    expect(wrapper.get('[role="status"]').text()).toBe("");
    expect(wrapper.emitted("saved")).toBeUndefined();
  });

  it("shows a failed save in place and keeps the text", async () => {
    vi.mocked(saveWeekReview).mockRejectedValue(new TypeError("fetch"));
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentBadly"]').setValue("Zu wenig Schlaf");
    await wrapper.get('[name="wentBadly"]').trigger("blur");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Keine Verbindung zum Server. Deine Antworten bleiben hier stehen.",
    );
    expect(field(wrapper, "wentBadly").value).toBe("Zu wenig Schlaf");
    expect(wrapper.get('[role="status"]').text()).toBe("");
  });

  it("never overwrites unsaved typing with a fresh read", async () => {
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentWell"]').setValue("Halb geschrieben");
    await wrapper.setProps({ answers: { ...EMPTY } });
    expect(field(wrapper, "wentWell").value).toBe("Halb geschrieben");
  });

  it("waits for a week still ahead", () => {
    const wrapper = mountAnswers(EMPTY, true);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("sobald die Woche begonnen hat");
  });

  it("saves dictated text by itself, like typing", async () => {
    vi.useFakeTimers();
    vi.mocked(saveWeekReview).mockImplementation(async (_week, input) => ({
      wentWell: input.wentWell || null,
      wentBadly: input.wentBadly || null,
      changeNext: input.changeNext || null,
    }));
    const wrapper = mount(ReviewAnswers, {
      props: { week: MONDAY, answers: { ...EMPTY, wentBadly: "Zu spät" }, ahead: false },
      global: { stubs: { MicButton: MicStub } },
    });
    const mics = wrapper.findAllComponents(MicStub);
    expect(mics.map((mic) => mic.props("label"))).toEqual([
      "Antwort diktieren: Was lief gut?",
      "Antwort diktieren: Was lief nicht gut?",
      "Antwort diktieren: Was ändere ich?",
    ]);
    await dictate(wrapper, "ins Bett gegangen", 1);
    expect(field(wrapper, "wentBadly").value).toBe("Zu spät ins Bett gegangen");
    expect(wrapper.get('[role="status"]').text()).toBe("Speichert …");
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(saveWeekReview).toHaveBeenCalledWith(MONDAY, {
      wentWell: "",
      wentBadly: "Zu spät ins Bett gegangen",
      changeNext: "",
    });
  });
});
