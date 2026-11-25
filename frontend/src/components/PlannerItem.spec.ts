import { PLANNER_HABIT_FIELDS, PLANNER_TODO_FIELDS } from "../types/fixtures";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DayPlannerHabitItem,
  DayPlannerTodoItem,
} from "../types/day-planner";
import type { MenuEntry } from "../utils/row-actions";
import PlannerItem from "./PlannerItem.vue";

enableAutoUnmount(afterEach);

function makeTodo(
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem {
  return {
    ...PLANNER_TODO_FIELDS,
    type: "todo",
    todoId: 1,
    title: "NestJS lernen",
    status: "pending",
    scheduledDate: "2026-10-02",
    timeOfDay: "10:00",
    completedAt: null,
    plannedDurationMinutes: 30,
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

function makeHabit(
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem {
  return {
    ...PLANNER_HABIT_FIELDS,
    type: "habit",
    plannedDurationMinutes: null,
    occurrenceId: 20,
    habitId: 10,
    title: "Joggen",
    status: "pending",
    scheduledDate: "2026-10-02",
    moveUntil: null,
    scheduleType: "interval",
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

describe("PlannerItem", () => {
  it("names a daily's running series calmly, and nothing without one", () => {
    const running = mount(PlannerItem, {
      props: {
        item: makeHabit({ streak: { current: 12, best: 21, unit: "runs" } }),
        isUpdating: false,
      },
    });
    expect(running.text()).toContain("Daily 12 in Folge");
    expect(running.text()).not.toContain("Rekord");
    const broken = mount(PlannerItem, {
      props: {
        item: makeHabit({ streak: { current: 0, best: 21, unit: "runs" } }),
        isUpdating: false,
      },
    });
    expect(broken.text()).not.toContain("in Folge");
  });

  it("shows the given time and duration; the time column says Termin", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ categoryName: "Lernen" }),
        time: "10:00",
        isUpdating: false,
      },
    });

    expect(wrapper.get("h3").text()).toBe("NestJS lernen");
    expect(wrapper.get(".planner-item__time").text()).toBe("10:00");
    expect(wrapper.text()).toContain("Lernen");
    expect(wrapper.text()).toContain("30 Min.");
    expect(wrapper.text()).not.toContain("Termin");
    // The day is today; repeating it on every row is noise.
    expect(wrapper.text()).not.toContain("02.10.2026");
  });

  it("puts logged time beside the planned time and names the goal", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          workedMinutes: 45,
          plannedDurationMinutes: 60,
          goal: {
            title: "Halbmarathon",
            completed: null,
            target: null,
            periodEnd: null,
          },
        }),
        isUpdating: false,
      },
    });
    expect(wrapper.text()).toContain("45/60 Min.");
  });

  it("draws the stripe and the chip's badge in the campaign's stored colour", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          campaign: { id: 4, title: "Halbmarathon", color: "plum", icon: "star" },
        }),
        isUpdating: false,
      },
    });
    expect(wrapper.attributes("style")).toContain(
      "--campaign-mark: var(--color-mark-plum)",
    );
    const chip = wrapper.get(".campaign-chip");
    expect(chip.attributes("style")).toContain("--mark: var(--color-mark-plum)");
    expect(chip.find(".campaign-chip__badge svg").exists()).toBe(true);
  });

  it("marks the campaign an item works towards", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          campaign: { id: 4, title: "Halbmarathon", color: null, icon: null },
        }),
        isUpdating: false,
      },
    });
    // Named in words beside the stripe, so colour is never the only sign.
    const chip = wrapper.get(".campaign-chip");
    expect(chip.get(".campaign-chip__name").text()).toBe("Halbmarathon");
    expect(chip.attributes("title")).toBe("Halbmarathon");
    expect(wrapper.classes()).toContain("item-row--campaign");
    expect(wrapper.attributes("style")).toContain("--campaign-mark");

    const loose = mount(PlannerItem, {
      props: { item: makeTodo(), isUpdating: false },
    });
    expect(loose.classes()).not.toContain("item-row--campaign");
  });

  it("drags as a whole card in the order, without a grip", () => {
    const item = makeTodo({ timeOfDay: null });
    const wrapper = mount(PlannerItem, {
      props: { item, isUpdating: false, sortable: true },
    });
    expect(wrapper.classes()).toContain("card-drag");
    expect(wrapper.find(".sort-handle").exists()).toBe(false);
    expect(wrapper.find(".item-row__leading").exists()).toBe(false);
  });

  it("opens the editor from a tap anywhere on the card but its controls", async () => {
    const item = makeTodo({ timeOfDay: null });
    const wrapper = mount(PlannerItem, {
      props: { item, isUpdating: false },
    });
    await wrapper.get(".item-row__meta").trigger("click");
    expect(wrapper.emitted("edit")).toEqual([[item]]);
    await wrapper.get(".check-ring, [role='checkbox'], button").trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });

  it("leaves out the chip on a campaign's own quest; its stripe says it", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          todoId: 4,
          campaign: { id: 4, title: "Halbmarathon", color: null, icon: null },
        }),
        isUpdating: false,
      },
    });
    expect(wrapper.find(".campaign-chip").exists()).toBe(false);
    expect(wrapper.classes()).toContain("item-row--campaign");
  });

  it("shows the original day for carried-over items and hides actions when compact", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeHabit({ isOverdue: true, scheduledDate: "2026-09-28" }),
        isUpdating: false,
        showDate: true,
        compact: true,
      },
    });
    expect(wrapper.get(".planner-item__time").text()).toBe("28.09.");
    expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(false);
    expect(wrapper.find(".timer-icon").exists()).toBe(false);
  });

  it("offers no Play for a completed Quest", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          timeOfDay: null,
          completedAt: "2026-10-02T18:30:00Z",
          status: "completed",
        }),
        isUpdating: false,
      },
    });
    expect(
      wrapper.find('[aria-label="Stoppuhr für NestJS lernen starten"]').exists(),
    ).toBe(false);
  });
  it("emits toggle with the original item", async () => {
    const item = makeTodo();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([[item]]);
  });

  it("keeps only ring, title and ▶ in the row and the rest in its menu", async () => {
    const skip = vi.fn();
    const menu: MenuEntry[] = [
      {
        id: "skip",
        label: "Überspringen",
        icon: "skip",
        ariaLabel: "Joggen überspringen",
        run: skip,
      },
    ];
    const wrapper = mount(PlannerItem, {
      props: { item: makeHabit(), isUpdating: false, menu },
    });

    // No permanent text buttons: the row's buttons are ring, title, ▶ and "…".
    expect(
      wrapper.findAll("button").map((b) => b.attributes("aria-label")),
    ).toEqual([
      "Joggen erledigen",
      "Joggen bearbeiten",
      "Stoppuhr für Joggen starten",
      "Aktionen für Joggen",
    ]);
    await wrapper.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    await wrapper.get('[aria-label="Joggen überspringen"]').trigger("click");
    expect(skip).toHaveBeenCalledOnce();
  });

  it("emits edit for a todo", async () => {
    const item = makeTodo();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    expect(wrapper.emitted("edit")).toEqual([[item]]);

    expect(wrapper.emitted("toggle")).toBeUndefined();
  });

  it("emits edit for a habit", async () => {
    const item = makeHabit();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");

    expect(wrapper.emitted("edit")).toEqual([[item]]);

    expect(wrapper.emitted("toggle")).toBeUndefined();
  });

  it("shows no menu button when the view offers no actions", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo(),
        isUpdating: false,
      },
    });

    expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(false);
  });

  it.each(["completed", "skipped"] as const)(
    "offers reopening and editing for a %s habit",
    (status) => {
      const wrapper = mount(PlannerItem, {
        props: {
          item: makeHabit({ status }),
          isUpdating: false,
          menu: [
            { id: "skip", label: "Überspringen", icon: "skip", run: () => {} },
          ],
        },
      });

      expect(wrapper.get(".check-ring").attributes("aria-label")).toBe(
        "Joggen wieder öffnen",
      );

      // Resolved rows have nothing to start or move.
      expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(false);
      expect(wrapper.find(".timer-icon").exists()).toBe(false);

      expect(
        wrapper.find('button[aria-label="Joggen bearbeiten"]').exists(),
      ).toBe(true);
    },
  );

  it("marks overdue items visually", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ isOverdue: true }),
        isUpdating: false,
      },
    });

    expect(wrapper.classes()).toContain("planner-item--overdue");
  });

  it("disables all habit actions while an update is running", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeHabit(),
        isUpdating: true,
        menu: [
          { id: "skip", label: "Überspringen", icon: "skip", run: () => {} },
        ],
      },
    });

    const buttons = wrapper.findAll("button");

    // Abhaken, Bearbeiten, Timer und das Menü.
    expect(buttons).toHaveLength(4);

    for (const button of buttons) {
      expect(button.element.disabled).toBe(true);
    }

    expect(wrapper.get(".check-ring").attributes("aria-busy")).toBe("true");
  });
});

describe("PlannerItem: Daily marker and Warum", () => {
  it("leads a Daily's meta line with the Daily marker", () => {
    const wrapper = mount(PlannerItem, {
      props: { item: makeHabit({ categoryName: "Sport" }), isUpdating: false },
    });
    const meta = wrapper.get(".item-row__meta");
    expect(meta.element.firstElementChild!.textContent!.trim()).toBe("Daily");
    expect(meta.find("svg").exists()).toBe(true);
    expect(meta.text()).toContain("Sport");
  });

  it("shows the Warum in one quiet line, not on done rows", () => {
    const open = mount(PlannerItem, {
      props: {
        item: makeTodo({ why: "Damit der Kopf frei ist" }),
        isUpdating: false,
      },
    });
    const why = open.get(".planner-item__why");
    expect(why.text()).toBe("Damit der Kopf frei ist");
    expect(why.attributes("title")).toBe("Damit der Kopf frei ist");
    expect(why.classes()).not.toContain("planner-item__why--wide");

    const wide = mount(PlannerItem, {
      props: {
        item: makeTodo({ why: "Später" }),
        isUpdating: false,
        whyWideOnly: true,
      },
    });
    expect(wide.get(".planner-item__why").classes()).toContain(
      "planner-item__why--wide",
    );

    const done = mount(PlannerItem, {
      props: {
        item: makeTodo({ why: "Vorbei", status: "completed" }),
        isUpdating: false,
      },
    });
    expect(done.find(".planner-item__why").exists()).toBe(false);
  });
});

describe("PlannerItem: meta line and past appointments", () => {
  it("names an appointment Termin where no time column shows it", () => {
    const carried = mount(PlannerItem, {
      props: { item: makeTodo(), showDate: true, isUpdating: false },
    });
    expect(carried.get(".item-row__meta").text()).toContain("Termin");
    const plain = mount(PlannerItem, {
      props: { item: makeTodo(), isUpdating: false },
    });
    expect(plain.get(".item-row__meta").text()).toContain("Termin");
  });

  it("lets the meta line wrap on a phone, as in the Kalender", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          campaign: { id: 9, title: "Halbmarathon schaffen", color: null, icon: null },
        }),
        isUpdating: false,
      },
    });
    expect(wrapper.classes()).toContain("item-row--wrap-meta");
    expect(wrapper.get(".campaign-chip").text()).toContain(
      "Halbmarathon schaffen",
    );
  });

  it("asks about a past appointment in one quiet line, without a move button", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ why: "Wird ersetzt" }),
        time: "10:00",
        past: true,
        isUpdating: false,
      },
    });
    expect(wrapper.get(".planner-item__nudge").text()).toBe(
      "Vorbei – erledigt?",
    );
    expect(wrapper.find(".planner-item__why").exists()).toBe(false);
    expect(wrapper.find("[data-move-button]").exists()).toBe(false);
  });
});
