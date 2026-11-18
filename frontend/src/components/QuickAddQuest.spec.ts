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

  it("says in words what Oben and Unten decide", () => {
    const { wrapper } = mountField();
    const group = wrapper.get('[role="group"]');
    const label = wrapper.get(`#${group.attributes("aria-labelledby")}`);
    expect(label.text()).toBe("Neue Quests");
    expect(label.classes()).not.toContain("visually-hidden");
    expect(group.findAll("button").map((button) => button.text())).toEqual([
      "Oben",
      "Unten",
    ]);
  });

  it("puts the quest in front of the day's order when asked", async () => {
    const { wrapper, type } = mountField();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Oben")!
      .trigger("click");
    await type("Kapitel schreiben");

    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 7 },
      ...order,
    ]);
    expect(wrapper.emitted("created")).toHaveLength(1);
  });

  it("names its day and always joins the end when the place is not offered", async () => {
    const wrapper = mount(QuickAddQuest, {
      props: {
        date: "2026-11-19",
        label: "Quest für Donnerstag, 19. Nov. hinzufügen",
        choosePlace: false,
      },
    });
    expect(wrapper.find('[role="group"]').exists()).toBe(false);
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
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Oben")!
      .trigger("click");
    await type("Kapitel schreiben");

    expect(wrapper.emitted("created")).toHaveLength(1);
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
  });
});
