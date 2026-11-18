import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBurnup } from "../api/todo-hierarchy.api";
import GoalBurnup from "./GoalBurnup.vue";

vi.mock("../api/todo-hierarchy.api", () => ({ getBurnup: vi.fn() }));
enableAutoUnmount(afterEach);

async function render() {
  const wrapper = mount(GoalBurnup, { props: { todoId: 1 } });
  await flushPromises();
  return wrapper;
}
const press = (wrapper: Awaited<ReturnType<typeof render>>, label: string) =>
  wrapper
    .findAll("button")
    .find((item) => item.text() === label)!
    .trigger("click");

describe("GoalBurnup", () => {
  beforeEach(() => {
    vi.mocked(getBurnup).mockResolvedValue([
      {
        date: "2026-10-30",
        doneCount: 1,
        totalCount: 2,
        doneMinutes: 30,
        totalMinutes: 60,
      },
      {
        date: "2026-10-31",
        doneCount: 1,
        totalCount: 4,
        doneMinutes: 30,
        totalMinutes: 90,
      },
    ]);
  });

  it("shows done and total scope with its growth", async () => {
    const wrapper = await render();
    expect(wrapper.findAll("polyline")).toHaveLength(2);
    expect(wrapper.text()).toContain("1 von 4 Quests erledigt, 3 noch offen");
    expect(wrapper.text()).toContain("Gesamtumfang");
  });

  it("switches to the remaining line and to minutes", async () => {
    const wrapper = await render();
    await press(wrapper, "Noch offen");
    expect(wrapper.findAll("polyline")).toHaveLength(1);
    expect(wrapper.find(".burnup__legend").text()).toContain("Noch offen");
    await press(wrapper, "Minuten");
    expect(wrapper.text()).toContain("30 von 90 Min. erledigt");
  });

  it("shows the numbers without a chart while there is only one day", async () => {
    vi.mocked(getBurnup).mockResolvedValueOnce([
      {
        date: "2026-10-30",
        doneCount: 0,
        totalCount: 3,
        doneMinutes: 0,
        totalMinutes: 0,
      },
    ]);
    const wrapper = await render();
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(wrapper.find(".burnup__legend").exists()).toBe(false);
    expect(wrapper.find(".burnup__summary").text()).toBe(
      "0 von 3 Quests erledigt, 3 noch offen. Stand 30.10.",
    );
    expect(wrapper.text()).toContain("Der Verlauf beginnt heute.");
    expect(wrapper.findAll("button").map((item) => item.text())).toEqual([
      "Anzahl",
      "Minuten",
    ]);
  });

  it("ends the summary with the date's own full stop", async () => {
    const wrapper = await render();
    expect(wrapper.find(".burnup__summary").text()).toBe(
      "1 von 4 Quests erledigt, 3 noch offen. Stand 31.10., seit 30.10.",
    );
  });

  it("shows why loading failed", async () => {
    vi.mocked(getBurnup).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = await render();
    expect(wrapper.find('[role="alert"] p').text()).toBe("Offline");
    await press(wrapper, "Erneut versuchen");
    await flushPromises();
    expect(wrapper.findAll("polyline")).toHaveLength(2);
  });

  it("draws progress in ink and the scope as a dashed muted line", async () => {
    const wrapper = await render();
    expect(wrapper.find(".burnup__line--actual").exists()).toBe(true);
    expect(wrapper.find(".burnup__line--scope").exists()).toBe(true);
    expect(wrapper.html()).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
