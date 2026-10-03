import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeHabitSchedule,
  deleteHabit,
  deleteTodo,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type {
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
} from "../types/habit";
import type { TodoResponse } from "../types/todo";
import PlannerItemEditor from "./PlannerItemEditor.vue";

vi.mock("../api/day-planner.api", () => ({
  getTodo: vi.fn(),
  getHabit: vi.fn(),
  updateTodo: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteTodo: vi.fn(),
  deleteHabit: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const todo: TodoResponse = {
  id: 1,
  title: "NestJS lernen",
  completed: false,
  completedAt: null,
  scheduledAt: "2026-10-02T08:00:12.000Z",
  plannedDurationMinutes: 30,
  isFixed: false,
};
const interval: HabitScheduleRule = {
  type: "interval",
  intervalDays: 2,
  missedOccurrencePolicy: "carry_over",
};
function version(
  schedule: HabitScheduleRule = interval,
  effectiveFrom = "2026-10-01",
): ScheduleVersionResponse {
  return {
    id: 100,
    effectiveFrom,
    effectiveAt: `${effectiveFrom}T08:00:00.000Z`,
    endsAt: null,
    cancelledAt: null,
    firstDueDate: effectiveFrom,
    schedule,
  };
}
function makeHabit(overrides: Partial<HabitResponse> = {}): HabitResponse {
  return {
    id: 10,
    title: "Joggen",
    isActive: true,
    plannedDurationMinutes: null,
    timerOccurrenceId: null,
    timerDurationMinutes: null,
    currentSchedule: version(),
    upcomingSchedule: null,
    ...overrides,
  };
}
function mountHabitEditor() {
  return mount(PlannerItemEditor, { props: { kind: "habit", entityId: 10 } });
}
async function editSchedule(wrapper: ReturnType<typeof mountHabitEditor>) {
  await flushPromises();
  await wrapper.get('input[name="changeSchedule"]').setValue(true);
}
async function save(wrapper: ReturnType<typeof mountHabitEditor>) {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

describe("PlannerItemEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    vi.mocked(getTodo).mockResolvedValue(todo);
    vi.mocked(getHabit).mockResolvedValue(makeHabit());
    vi.mocked(updateTodo).mockResolvedValue(todo);
    vi.mocked(updateHabit).mockResolvedValue(makeHabit());
    vi.mocked(changeHabitSchedule).mockResolvedValue(makeHabit());
    vi.mocked(deleteTodo).mockResolvedValue(undefined);
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
  });

  it("updates or clears a Habit default duration without changing its schedule", async () => {
    vi.mocked(getHabit).mockResolvedValue(
      makeHabit({ plannedDurationMinutes: 10 }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[name="duration"]').element.value,
    ).toBe("10");
    await wrapper.get('input[name="duration"]').setValue("");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, {
      plannedDurationMinutes: null,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });
  it("saves a todo without changing an untouched timestamp", async () => {
    const wrapper = mount(PlannerItemEditor, {
      props: { kind: "todo", entityId: 1 },
    });
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Vue lernen");
    await save(wrapper);
    expect(updateTodo).toHaveBeenCalledWith(1, {
      title: "Vue lernen",
      scheduledAt: todo.scheduledAt,
      plannedDurationMinutes: 30,
      isFixed: false,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("shows the current schedule without enabling schedule writes", async () => {
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.get('[data-test="schedule-summary"]').text()).toContain(
      "Alle 2 Tage",
    );
    expect(wrapper.text()).toContain("01.10.2026");
    expect(wrapper.find('[data-test="schedule-fields"]').exists()).toBe(false);
    await save(wrapper);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it("sends only changed metadata and preserves a planned schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 3 },
          "2026-10-10",
        ),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.text()).toContain("Geplant ab 10.10.2026");
    await wrapper.get('input[name="title"]').setValue("Gitarre spielen");
    await wrapper.get('input[name="isActive"]').setValue(false);
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Gitarre spielen",
      isActive: false,
    });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it("defaults the change date to today in Europe/Berlin, not the device zone", async () => {
    vi.setSystemTime(new Date("2026-10-01T22:30:00Z"));
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    expect(
      wrapper.get<HTMLInputElement>('input[name="effectiveFrom"]').element
        .value,
    ).toBe("2026-10-02");
    expect(wrapper.get('input[name="effectiveFrom"]').attributes("min")).toBe(
      "2026-10-02",
    );
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await save(wrapper);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "interval",
        intervalDays: 4,
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("allows a future effective date", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="effectiveFrom"]').setValue("2026-10-10");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: interval,
    });
    expect(wrapper.text()).toContain("10.10.2026");
  });

  it("prefills a future version explicitly when editing the planned schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 5 },
          "2026-10-10",
        ),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    expect(
      wrapper.get<HTMLInputElement>('input[name="effectiveFrom"]').element
        .value,
    ).toBe("2026-10-10");
    expect(
      wrapper.get<HTMLInputElement>('input[name="weeklyTarget"]').element.value,
    ).toBe("5");
    await wrapper.get('input[name="weeklyTarget"]').setValue("4");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: { type: "weekly_target", weeklyTarget: 4 },
    });
  });

  it("handles a habit that has only an upcoming schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: null,
        upcomingSchedule: version(interval, "2026-10-10"),
      }),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.text()).toContain("noch keinen aktuell gültigen Zeitplan");
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: interval,
    });
  });

  it("handles a habit without either schedule", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({ currentSchedule: null }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: interval,
    });
  });

  it("switches to fixed weekdays without incompatible fields", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await wrapper
      .get('input[name="weekdays"][value="thursday"]')
      .setValue(true);
    await wrapper.get('input[name="weekdays"][value="monday"]').setValue(true);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "fixed_weekdays",
        weekdays: ["monday", "thursday"],
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("prefills existing weekdays and allows changing them", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: version({
          type: "fixed_weekdays",
          weekdays: ["monday", "thursday"],
          missedOccurrencePolicy: "skip",
        }),
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    expect(
      wrapper.get<HTMLInputElement>('input[value="monday"]').element.checked,
    ).toBe(true);
    await wrapper.get('input[value="monday"]').setValue(false);
    await wrapper.get('input[value="saturday"]').setValue(true);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "fixed_weekdays",
        weekdays: ["thursday", "saturday"],
        missedOccurrencePolicy: "skip",
      },
    });
  });

  it("switches to weekly target without sending a missed-occurrence policy", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("weekly_target");
    await wrapper.get('input[name="weeklyTarget"]').setValue("5");
    expect(wrapper.find('select[name="missedPolicy"]').exists()).toBe(false);
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: { type: "weekly_target", weeklyTarget: 5 },
    });
  });

  it("switches from weekly target to interval", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce(
      makeHabit({
        currentSchedule: version({ type: "weekly_target", weeklyTarget: 3 }),
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("interval");
    await wrapper.get('input[name="intervalDays"]').setValue("3");
    await wrapper.get('select[name="missedPolicy"]').setValue("carry_over");
    await save(wrapper);
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-02",
      schedule: {
        type: "interval",
        intervalDays: 3,
        missedOccurrencePolicy: "carry_over",
      },
    });
  });

  it("does not submit a schedule when its checkbox is cleared", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await wrapper.get('input[name="changeSchedule"]').setValue(false);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledWith(10, { title: "Neuer Titel" });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
  });

  it.each(["2026-10-01", ""])(
    "rejects invalid or past effective date '%s' before any write",
    async (date) => {
      const wrapper = mountHabitEditor();
      await editSchedule(wrapper);
      await wrapper.get('input[name="title"]').setValue("Neuer Titel");
      await wrapper.get('input[name="effectiveFrom"]').setValue(date);
      await save(wrapper);
      expect(updateHabit).not.toHaveBeenCalled();
      expect(changeHabitSchedule).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain(
        "heute oder ein zukünftiges gültiges Datum",
      );
    },
  );

  it("rejects weekdays without a selected day", async () => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte wähle mindestens einen Wochentag.",
    );
  });

  it.each(["0", "-1", "1.5"])("rejects invalid interval %s", async (value) => {
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="intervalDays"]').setValue(value);
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "ganze Zahl ab 1 Tag",
    );
  });

  it.each(["0", "8", "1.5"])(
    "rejects invalid weekly target %s",
    async (value) => {
      const wrapper = mountHabitEditor();
      await editSchedule(wrapper);
      await wrapper
        .get('select[name="scheduleType"]')
        .setValue("weekly_target");
      await wrapper.get('input[name="weeklyTarget"]').setValue(value);
      await save(wrapper);
      expect(changeHabitSchedule).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Das Wochenziel muss zwischen 1 und 7 liegen.",
      );
    },
  );

  it("does not change the schedule after metadata fails", async () => {
    vi.mocked(updateHabit).mockRejectedValueOnce(
      new Error("Metadaten fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await save(wrapper);
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.emitted("changed")).toBeUndefined();
  });

  it("reports partial success and retries only the failed schedule request", async () => {
    vi.mocked(updateHabit).mockResolvedValueOnce(
      makeHabit({ title: "Neuer Titel" }),
    );
    vi.mocked(changeHabitSchedule).mockRejectedValueOnce(new Error("Konflikt"));
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await save(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen",
    );
    expect(wrapper.emitted("changed")).toBeUndefined();
    expect(
      wrapper.get<HTMLInputElement>('input[name="intervalDays"]').element.value,
    ).toBe("4");
    await save(wrapper);
    expect(updateHabit).toHaveBeenCalledTimes(1);
    expect(changeHabitSchedule).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("prevents duplicate submissions while a schedule write is pending", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(changeHabitSchedule).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mountHabitEditor();
    await editSchedule(wrapper);
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(changeHabitSchedule).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(true);
    resolve(makeHabit());
    await flushPromises();
    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("shows a load error without allowing edits", async () => {
    vi.mocked(getHabit).mockRejectedValueOnce(
      new Error("Laden fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Laden fehlgeschlagen");
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it.each([
    ["todo", 1],
    ["habit", 10],
  ] as const)(
    "requires confirmation before deleting a %s",
    async (kind, entityId) => {
      const wrapper = mount(PlannerItemEditor, { props: { kind, entityId } });
      await flushPromises();
      await wrapper.get('[data-test="request-delete"]').trigger("click");
      expect(deleteTodo).not.toHaveBeenCalled();
      expect(deleteHabit).not.toHaveBeenCalled();
      await wrapper.get('[data-test="confirm-delete"]').trigger("click");
      await flushPromises();
      if (kind === "todo") expect(deleteTodo).toHaveBeenCalledWith(1);
      else expect(deleteHabit).toHaveBeenCalledWith(10);
      expect(wrapper.emitted("changed")).toEqual([[]]);
    },
  );

  it("keeps the editor open when deletion fails", async () => {
    vi.mocked(deleteHabit).mockRejectedValueOnce(
      new Error("Löschen fehlgeschlagen"),
    );
    const wrapper = mountHabitEditor();
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Löschen fehlgeschlagen");
    expect(wrapper.emitted("changed")).toBeUndefined();
    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(false);
  });
});
