import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHabit } from "../api/day-planner.api";
import type { HabitResponse } from "../types/habit";
import CreateHabitForm from "./CreateHabitForm.vue";
vi.mock("../api/day-planner.api", () => ({ createHabit: vi.fn() }));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());
const response: HabitResponse = {
  id: 10,
  title: "Joggen",
  isActive: true,
  currentSchedule: null,
  upcomingSchedule: null,
};
async function submit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}
describe("CreateHabitForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T22:30:00Z"));
    vi.mocked(createHabit).mockResolvedValue(response);
  });
  it("creates a daily habit and leaves an omitted start date to the backend", async () => {
    const wrapper = mount(CreateHabitForm);
    expect(wrapper.text()).toContain("02.10.2026");
    await wrapper.get('input[name="title"]').setValue("  Joggen  ");
    await submit(wrapper);
    expect(createHabit).toHaveBeenCalledWith({
      title: "Joggen",
      schedule: {
        type: "interval",
        intervalDays: 1,
        missedOccurrencePolicy: "carry_over",
      },
    });
    expect(wrapper.emitted("created")).toEqual([[]]);
    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("");
    expect(wrapper.emitted("busy")).toEqual([[true], [false]]);
  });
  it("sends an explicit future start date and interval", async () => {
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get('input[name="startDate"]').setValue("2026-10-10");
    await wrapper.get('input[name="intervalDays"]').setValue("2");
    await wrapper.get('select[name="missedPolicy"]').setValue("skip");
    await submit(wrapper);
    expect(createHabit).toHaveBeenCalledWith({
      title: "Joggen",
      startDate: "2026-10-10",
      schedule: {
        type: "interval",
        intervalDays: 2,
        missedOccurrencePolicy: "skip",
      },
    });
  });
  it("creates fixed weekdays ordered Monday to Sunday without interval fields", async () => {
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Gitarre spielen");
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await wrapper.get('input[value="thursday"]').setValue(true);
    await wrapper.get('input[value="monday"]').setValue(true);
    await submit(wrapper);
    expect(createHabit).toHaveBeenCalledWith({
      title: "Gitarre spielen",
      schedule: {
        type: "fixed_weekdays",
        weekdays: ["monday", "thursday"],
        missedOccurrencePolicy: "carry_over",
      },
    });
  });
  it("creates a weekly target without unsupported policy or weekday fields", async () => {
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Sport");
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await wrapper.get('input[value="monday"]').setValue(true);
    await wrapper.get('select[name="scheduleType"]').setValue("weekly_target");
    await wrapper.get('input[name="weeklyTarget"]').setValue("4");
    expect(wrapper.find('select[name="missedPolicy"]').exists()).toBe(false);
    await submit(wrapper);
    expect(createHabit).toHaveBeenCalledWith({
      title: "Sport",
      schedule: { type: "weekly_target", weeklyTarget: 4 },
    });
  });
  it.each(["", "   ", "x".repeat(201)])(
    "rejects an invalid title",
    async (title) => {
      const wrapper = mount(CreateHabitForm);
      await wrapper.get('input[name="title"]').setValue(title);
      await submit(wrapper);
      expect(createHabit).not.toHaveBeenCalled();
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    },
  );
  it.each(["0", "-1", "1.5"])("rejects invalid interval %s", async (value) => {
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get('input[name="intervalDays"]').setValue(value);
    await submit(wrapper);
    expect(createHabit).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "ganze Zahl ab 1 Tag",
    );
  });
  it("rejects empty fixed weekdays", async () => {
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await submit(wrapper);
    expect(createHabit).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte wähle mindestens einen Wochentag.",
    );
  });
  it.each(["0", "8", "1.5"])(
    "rejects invalid weekly target %s",
    async (value) => {
      const wrapper = mount(CreateHabitForm);
      await wrapper.get('input[name="title"]').setValue("Joggen");
      await wrapper
        .get('select[name="scheduleType"]')
        .setValue("weekly_target");
      await wrapper.get('input[name="weeklyTarget"]').setValue(value);
      await submit(wrapper);
      expect(createHabit).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain(
        "zwischen 1 und 7",
      );
    },
  );
  it("retains the inputs and unlocks the form when the backend fails", async () => {
    vi.mocked(createHabit).mockRejectedValueOnce(
      new Error("Backend nicht erreichbar"),
    );
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get('input[name="startDate"]').setValue("2026-10-10");
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("Joggen");
    expect(
      wrapper.get<HTMLInputElement>('input[name="startDate"]').element.value,
    ).toBe("2026-10-10");
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(false);
    expect(wrapper.emitted("created")).toBeUndefined();
  });
  it("blocks duplicate submissions until creation resolves", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(createHabit).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(CreateHabitForm);
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(createHabit).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(true);
    resolve(response);
    await flushPromises();
    expect(wrapper.emitted("created")).toEqual([[]]);
  });
});
