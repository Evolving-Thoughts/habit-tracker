import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveWeekReview } from "../api/week-review.api";
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

  it("asks the three questions and shows the stored answers", () => {
    const wrapper = mountAnswers({ ...EMPTY, wentWell: "Drei Kapitel" });
    expect(wrapper.findAll("label").map((label) => label.text())).toEqual([
      "Was lief gut?",
      "Was lief nicht gut?",
      "Was ändere ich?",
    ]);
    expect(
      (wrapper.get('[name="wentWell"]').element as HTMLTextAreaElement).value,
    ).toBe("Drei Kapitel");
    // Nothing to save until something changes.
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("saves on request, then says so quietly", async () => {
    vi.mocked(saveWeekReview).mockResolvedValue({
      ...EMPTY,
      changeNext: "Früher anfangen",
    });
    const wrapper = mountAnswers();
    await wrapper.get('[name="changeNext"]').setValue("Früher anfangen ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(saveWeekReview).toHaveBeenCalledWith(MONDAY, {
      wentWell: "",
      wentBadly: "",
      changeNext: "Früher anfangen ",
    });
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert");
    expect(wrapper.emitted("saved")).toEqual([
      [{ ...EMPTY, changeNext: "Früher anfangen" }],
    ]);
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("shows a failed save in place and keeps the text", async () => {
    vi.mocked(saveWeekReview).mockRejectedValue(new TypeError("fetch"));
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentBadly"]').setValue("Zu wenig Schlaf");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Keine Verbindung zum Server. Deine Antworten bleiben hier stehen.",
    );
    expect(
      (wrapper.get('[name="wentBadly"]').element as HTMLTextAreaElement).value,
    ).toBe("Zu wenig Schlaf");
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it("never overwrites unsaved typing with a fresh read", async () => {
    const wrapper = mountAnswers();
    await wrapper.get('[name="wentWell"]').setValue("Halb geschrieben");
    await wrapper.setProps({ answers: { ...EMPTY } });
    expect(
      (wrapper.get('[name="wentWell"]').element as HTMLTextAreaElement).value,
    ).toBe("Halb geschrieben");
  });

  it("waits for a week still ahead", () => {
    const wrapper = mountAnswers(EMPTY, true);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("sobald die Woche begonnen hat");
  });
});
