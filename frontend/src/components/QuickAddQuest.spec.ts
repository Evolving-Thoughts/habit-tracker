import { TODO_FIELDS } from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTodo, reorderDay } from "../api/day-planner.api";
import QuickAddQuest from "./QuickAddQuest.vue";

vi.mock("../api/day-planner.api", () => ({
  createTodo: vi.fn(),
  reorderDay: vi.fn(),
}));

enableAutoUnmount(afterEach);

const created = {
  ...TODO_FIELDS,
  id: 7,
  parentId: null,
  title: "Kapitel schreiben",
  completed: false,
  completedAt: null,
  scheduledDate: "2026-10-02",
  timeOfDay: null,
  plannedDurationMinutes: null,
  timerEligible: true,
};
const order = [
  { type: "todo" as const, id: 1 },
  { type: "habit" as const, id: 20 },
];

function mountField() {
  const wrapper = mount(QuickAddQuest, {
    props: { date: "2026-10-02", order },
  });
  const type = async (text: string) => {
    await wrapper.get('input[name="quickTitle"]').setValue(text);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
  };
  return { wrapper, type };
}

describe("QuickAddQuest", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    vi.mocked(createTodo).mockResolvedValue(created);
    vi.mocked(reorderDay).mockResolvedValue(undefined);
  });

  it("plans a quest for the day and lets it join the end", async () => {
    const { wrapper, type } = mountField();
    await type("  Kapitel schreiben ");

    expect(createTodo).toHaveBeenCalledWith({
      title: "Kapitel schreiben",
      scheduledDate: "2026-10-02",
      timeOfDay: null,
      plannedDurationMinutes: null,
    });
    expect(reorderDay).not.toHaveBeenCalled();
    expect(wrapper.emitted("created")).toHaveLength(1);
    expect(
      wrapper.get<HTMLInputElement>('input[name="quickTitle"]').element.value,
    ).toBe("");
  });

  it("puts a quest into the Questlog at the head or the end, as chosen", async () => {
    const wrapper = mount(QuickAddQuest, {
      props: { date: null, label: "Quest ins Questlog hinzufügen" },
    });
    const field = wrapper.get('input[name="quickTitle"]');
    expect(field.attributes("aria-label")).toBe("Quest ins Questlog hinzufügen");
    await field.setValue("Steuern");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodo).toHaveBeenLastCalledWith({
      title: "Steuern",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      backlogPlace: "bottom",
    });
    await wrapper.get('[aria-label="Oben einfügen"]').trigger("click");
    await field.setValue("Fenster putzen");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ backlogPlace: "top" }),
    );
    // The server places it; no day is sorted.
    expect(reorderDay).not.toHaveBeenCalled();
    expect(wrapper.emitted("created")).toHaveLength(2);
  });

  it("names its two small toggles and which one holds", () => {
    const { wrapper } = mountField();
    const group = wrapper.get('[role="group"]');
    expect(group.attributes("aria-label")).toBe("Neue Quests einfügen");
    expect(
      group.findAll("button").map((button) => [
        button.attributes("aria-label"),
        button.attributes("aria-pressed"),
      ]),
    ).toEqual([
      ["Oben einfügen", "false"],
      ["Unten einfügen", "true"],
    ]);
  });

  it("puts the quest in front of the day's order when asked", async () => {
    const { wrapper, type } = mountField();
    await wrapper.get('button[aria-label="Oben einfügen"]').trigger("click");
    expect(
      wrapper.get('button[aria-label="Oben einfügen"]').attributes("aria-pressed"),
    ).toBe("true");
    await type("Kapitel schreiben");

    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 7 },
      ...order,
    ]);
    expect(wrapper.emitted("created")).toHaveLength(1);
  });

  it("keeps the choice for every quick add on the device", async () => {
    const first = mountField().wrapper;
    const second = mountField().wrapper;
    await first.get('button[aria-label="Oben einfügen"]').trigger("click");
    expect(
      second.get('button[aria-label="Oben einfügen"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(localStorage.getItem("quickAdd:place")).toBe("top");
    first.unmount();
    second.unmount();

    const later = mountField().wrapper;
    expect(
      later.get('button[aria-label="Oben einfügen"]').attributes("aria-pressed"),
    ).toBe("true");
  });

  it("names its day and joins the end of a day without an order", async () => {
    const wrapper = mount(QuickAddQuest, {
      props: {
        date: "2026-11-19",
        label: "Quest für Donnerstag, 19. Nov. hinzufügen",
      },
    });
    await wrapper.get('button[aria-label="Oben einfügen"]').trigger("click");
    const field = wrapper.get('input[name="quickTitle"]');
    expect(field.attributes("aria-label")).toBe(
      "Quest für Donnerstag, 19. Nov. hinzufügen",
    );
    expect(field.attributes("placeholder")).toBe("Quest hinzufügen …");

    await field.setValue("Geschenk kaufen");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledDate: "2026-11-19" }),
    );
    expect(reorderDay).not.toHaveBeenCalled();
    expect(wrapper.emitted("created")).toHaveLength(1);
  });

  it("ignores an empty line", async () => {
    const { wrapper, type } = mountField();
    await type("   ");
    expect(createTodo).not.toHaveBeenCalled();
    expect(wrapper.emitted("created")).toBeUndefined();
  });

  it("keeps the text and says why when creating fails", async () => {
    vi.mocked(createTodo).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper, type } = mountField();
    await type("Kapitel schreiben");

    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    expect(
      wrapper.get<HTMLInputElement>('input[name="quickTitle"]').element.value,
    ).toBe("Kapitel schreiben");
    expect(wrapper.emitted("created")).toBeUndefined();
  });

  it("still shows the new quest when only sorting it to the top fails", async () => {
    vi.mocked(reorderDay).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper, type } = mountField();
    await wrapper.get('button[aria-label="Oben einfügen"]').trigger("click");
    await type("Kapitel schreiben");

    expect(wrapper.emitted("created")).toHaveLength(1);
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
  });
});
