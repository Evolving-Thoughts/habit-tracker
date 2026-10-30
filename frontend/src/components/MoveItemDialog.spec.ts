import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rescheduleOccurrence, rescheduleTodo } from "../api/day-planner.api";
import type {
  DayPlannerHabitItem,
  DayPlannerTodoItem,
} from "../types/day-planner";
import MoveItemDialog from "./MoveItemDialog.vue";

vi.mock("../api/day-planner.api", () => ({
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
}));
enableAutoUnmount(afterEach);

const todo: DayPlannerTodoItem = {
  type: "todo",
  todoId: 1,
  title: "Saugen",
  status: "pending",
  scheduledDate: "2026-10-30",
  scheduledAt: "2026-10-30T08:00:00.000Z",
  completedAt: null,
  plannedDurationMinutes: null,
  isFixed: false,
  isOverdue: false,
  timerEligible: true,
};
const habit: DayPlannerHabitItem = {
  type: "habit",
  occurrenceId: 2,
  plannedDurationMinutes: null,
  habitId: 3,
  title: "Laufen",
  status: "pending",
  scheduledDate: "2026-10-30",
  moveUntil: "2026-10-31",
  scheduleType: "interval",
  isOverdue: false,
  timerEligible: true,
};

function render(item: DayPlannerTodoItem | DayPlannerHabitItem) {
  return mount(MoveItemDialog, {
    props: { item, today: "2026-10-30", returnFocus: () => null },
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
}
const button = (wrapper: ReturnType<typeof render>, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label);

describe("MoveItemDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves a todo to next Monday", async () => {
    const wrapper = render(todo);
    await button(wrapper, "Nächster Montag")!.trigger("click");
    expect(rescheduleTodo).toHaveBeenCalledWith(1, "2026-11-02", false);
    await vi.waitFor(() => expect(wrapper.emitted("moved")).toBeTruthy());
  });

  it("needs a confirmation for a fixed todo", async () => {
    const wrapper = render({ ...todo, isFixed: true });
    expect(button(wrapper, "Morgen")!.attributes("disabled")).toBeDefined();
    await wrapper.find('[data-test="move-confirm"]').setValue(true);
    await button(wrapper, "Morgen")!.trigger("click");
    expect(rescheduleTodo).toHaveBeenCalledWith(1, "2026-10-31", true);
  });

  it("offers a habit only days within its window", async () => {
    const wrapper = render(habit);
    expect(button(wrapper, "Nächster Montag")).toBeUndefined();
    await button(wrapper, "Morgen")!.trigger("click");
    expect(rescheduleOccurrence).toHaveBeenCalledWith(2, "2026-10-31");
  });

  it("shows why the server refused", async () => {
    vi.mocked(rescheduleTodo).mockRejectedValueOnce(new Error("Timer läuft"));
    const wrapper = render(todo);
    await button(wrapper, "Morgen")!.trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.find('[role="alert"]').text()).toBe("Timer läuft"),
    );
    expect(wrapper.emitted("moved")).toBeFalsy();
  });
});
