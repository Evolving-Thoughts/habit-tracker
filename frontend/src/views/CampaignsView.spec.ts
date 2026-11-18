import { TODO_FIELDS } from "../types/fixtures";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import CampaignsView from "./CampaignsView.vue";
import { getQuestHours } from "../api/quest-hours.api";
import type { QuestHoursResponse } from "../types/quest-hours";
import {
  getTodoHierarchy,
  getDeletionPreview,
} from "../api/todo-hierarchy.api";
import {
  updateTodo,
  updateTodoCompletion,
  deleteTodo,
} from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import type { HierarchyTodo, TodoProgress } from "../types/todo-hierarchy";
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(),
  getDeletionPreview: vi.fn(),
}));
vi.mock("../api/quest-hours.api", () => ({
  getQuestHours: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(),
}));
vi.mock("../api/day-planner.api", () => ({
  updateTodo: vi.fn(),
  updateTodoCompletion: vi.fn(),
  deleteTodo: vi.fn(),
}));
enableAutoUnmount(afterEach);
/** A quest without quests below: the server sends no progress for it. */
const LEAF: TodoProgress = {
  mode: "count",
  completed: 0,
  total: 0,
  percentage: 0,
  knownDurationMinutes: 0,
  todoCount: 0,
  doneCount: 0,
};
/** Quests of 30 minutes below a quest, never the quest itself. */
const below = (todoCount: number, doneCount = 0): TodoProgress => ({
  mode: "duration",
  completed: doneCount * 30,
  total: todoCount * 30,
  percentage: (doneCount / todoCount) * 100,
  knownDurationMinutes: todoCount * 30,
  todoCount,
  doneCount,
});
const node = (
  id: number,
  parentId: number | null,
  progress: TodoProgress = LEAF,
): HierarchyTodo => ({
  ...TODO_FIELDS,
  id,
  parentId,
  title: `Quest ${id}`,
  completed: false,
  timerEligible: true,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: 30,
  progress,
});
const button = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll("button").find((b) => b.text() === text)!;
const openMenu = (w: ReturnType<typeof mount>, title: string) =>
  w.get(`[aria-label="Aktionen für ${title}"][aria-haspopup]`).trigger("click");
const WEEKS = [
  "2026-09-28",
  "2026-10-05",
  "2026-10-12",
  "2026-10-19",
  "2026-10-26",
  "2026-11-02",
  "2026-11-09",
  "2026-11-16",
];
const questHours = (
  campaigns: QuestHoursResponse["campaigns"] = [],
): QuestHoursResponse => ({
  startDate: "2026-11-16",
  endDate: "2026-11-22",
  today: "2026-11-18",
  weeklyTargetMinutes: null,
  questMinutes: 0,
  otherMinutes: 0,
  days: [],
  weeks: WEEKS.map((startDate) => ({ startDate, questMinutes: 0 })),
  campaigns,
});
let router: Router;
const view = () =>
  mount(CampaignsView, {
    global: {
      plugins: [router],
      stubs: {
        ModalDialog: { template: '<section role="dialog"><slot /></section>' },
        PlannerItemEditor: true,
        CreateTodoForm: true,
        GoalBurnup: {
          props: { todoId: Number, besideBar: Boolean },
          template:
            '<p class="burnup-stub">Burnup {{ todoId }}{{ besideBar ? " beside the bar" : "" }}</p>',
        },
      },
    },
  });
describe("CampaignsView", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/kampagnen", component: { template: "<div />" } }],
    });
    await router.push("/kampagnen");
    vi.mocked(getQuestHours).mockResolvedValue(questHours());
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      node(1, null, below(1)),
      node(2, 1),
    ]);
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(updateTodo).mockResolvedValue(node(1, null));
    vi.mocked(updateTodoCompletion).mockResolvedValue();
    vi.mocked(deleteTodo).mockResolvedValue();
    vi.mocked(getDeletionPreview).mockResolvedValue({
      confirmationToken: "a".repeat(64),
      todos: [node(1, null), node(2, 1)],
      timers: [{ id: "timer", todoId: 2, title: "Quest 2", state: "paused" }],
    });
  });
  it("renders independent checkboxes, progress and hierarchy depth", async () => {
    const w = view();
    await flushPromises();
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
    expect(w.get('[data-todo-id="2"]').attributes("data-depth")).toBe("1");
    expect(w.get('[data-todo-id="2"]').text()).toContain("Gehört zu");
    expect(w.findAll("[role=checkbox]")).toHaveLength(2);
    // Only todos with sub-tasks show a progress bar; leaves stay calm.
    expect(w.findAll("[role=progressbar]")).toHaveLength(1);
    expect(w.get('[data-todo-id="1"]').text()).toContain("0/30 Min.");
    expect(w.get("[role=progressbar]").attributes("aria-valuetext")).toBe(
      "0 von 30 Minuten darunter erledigt",
    );
    expect(w.get('[data-todo-id="2"]').find(".row__progress").exists()).toBe(
      false,
    );
  });
  it("gives leaves no expander and names the category", async () => {
    vi.mocked(getCategories).mockResolvedValue([
      { id: 7, name: "Lernen" } as never,
    ]);
    // A campaign by its colour alone still stands in the tree.
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { ...node(1, null), categoryId: 7, why: "Für den Job", color: "berry" },
    ]);
    const w = view();
    await flushPromises();
    expect(w.find('[aria-label="Quest 1 einklappen"]').exists()).toBe(false);
    expect(w.text()).toContain("Lernen");
    expect(w.text()).toContain("Für den Job");
  });
  it("keeps row actions behind one menu that Escape closes", async () => {
    const w = view();
    await flushPromises();
    expect(w.find('[aria-label="Quest 1 verschieben"]').exists()).toBe(false);
    await openMenu(w, "Quest 1");
    const trigger = w.get('[data-menu-trigger="1"]');
    expect(trigger.attributes("aria-expanded")).toBe("true");
    const menuId = trigger.attributes("aria-controls")!;
    const menu = w.get(`#${menuId}`);
    const heading = w.get(`#${menu.attributes("aria-labelledby")}`);
    expect(heading.text()).toBe("Quest 1");
    expect(
      w.get('[aria-label="Quest 1 mit allen Unter-Quests löschen"]').classes(),
    ).not.toContain("btn--danger");
    expect(
      w.findAll(`#${menuId} [role=menuitem]`).map((b) => b.text()),
    ).toEqual([
      "Stoppuhr starten",
      "Unter-Quest hinzufügen",
      "Fortschritt anzeigen",
      "Verschieben",
      "Löschen",
    ]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(w.find(`#${menuId}`).exists()).toBe(false);
  });
  it("collapses and expands without changing data", async () => {
    const w = view();
    await flushPromises();
    await w.get('[aria-label="Quest 1 einklappen"]').trigger("click");
    expect(w.findAll("[data-todo-id]")).toHaveLength(1);
    await w.get('[aria-label="Quest 1 ausklappen"]').trigger("click");
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
  });
  it("toggles only the selected Quest and reloads computed progress", async () => {
    const w = view();
    await flushPromises();
    await w.findAll("[role=checkbox]")[1]!.trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(2, true);
    expect(getTodoHierarchy).toHaveBeenCalledTimes(2);
  });
  it("offers to take a completion back, as Heute does", async () => {
    const w = view();
    await flushPromises();
    await w.findAll("[role=checkbox]")[1]!.trigger("click");
    await flushPromises();
    expect(w.get(".undo-toast").text()).toContain("„Quest 2“ erledigt");
    await button(w, "Rückgängig").trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenLastCalledWith(2, false);
    expect(w.get(".undo-toast").text()).toBe("");
  });
  it("asks before completing a campaign with open quests", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      node(1, null, below(3, 1)),
      node(2, 1),
      node(3, 1),
      { ...node(4, 1), completed: true },
    ]);
    const w = view();
    await flushPromises();
    await w.get('[data-todo-id="1"] [role=checkbox]').trigger("click");
    await flushPromises();
    expect(w.get("[role=dialog]").text()).toContain(
      "2 Quests in „Quest 1“ sind noch offen. Sie bleiben offen",
    );
    expect(updateTodoCompletion).not.toHaveBeenCalled();
    await button(w, "Abbrechen").trigger("click");
    await flushPromises();
    expect(w.find("[role=dialog]").exists()).toBe(false);
    expect(updateTodoCompletion).not.toHaveBeenCalled();

    await w.get('[data-todo-id="1"] [role=checkbox]').trigger("click");
    await flushPromises();
    await button(w, "Kampagne abschließen").trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(w.get(".undo-toast").text()).toContain("„Quest 1“ abgeschlossen");
  });
  it("completes a campaign whose quests are all done without asking", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      node(1, null, below(1, 1)),
      { ...node(2, 1), completed: true },
    ]);
    const w = view();
    await flushPromises();
    await w.get('[data-todo-id="1"] [role=checkbox]').trigger("click");
    await flushPromises();
    expect(w.find("[role=dialog]").exists()).toBe(false);
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
  });
  it("never asks when a campaign is reopened", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { ...node(1, null, below(1)), completed: true },
      node(2, 1),
    ]);
    const w = view();
    await flushPromises();
    await w.get('[data-todo-id="1"] [role=checkbox]').trigger("click");
    await flushPromises();
    expect(w.find("[role=dialog]").exists()).toBe(false);
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, false);
    expect(w.get(".undo-toast").text()).toBe("");
  });
  it("excludes self and descendants from move choices and allows root", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Quest 1");
    await w.get('[aria-label="Quest 1 verschieben"]').trigger("click");
    expect(w.findAll("select option")).toHaveLength(1);
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(updateTodo).toHaveBeenCalledWith(1, { parentId: null });
  });
  it("does not delete when preview is cancelled and shows active/paused timers", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Quest 1");
    await w
      .get('[aria-label="Quest 1 mit allen Unter-Quests löschen"]')
      .trigger("click");
    await flushPromises();
    expect(w.text()).toContain("pausiert");
    await w.get("[data-cancel-delete]").trigger("click");
    expect(deleteTodo).not.toHaveBeenCalled();
  });
  it("confirms exactly the reviewed snapshot", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Quest 1");
    await w
      .get('[aria-label="Quest 1 mit allen Unter-Quests löschen"]')
      .trigger("click");
    await flushPromises();
    await button(w, "Ja, löschen").trigger("click");
    await flushPromises();
    expect(deleteTodo).toHaveBeenCalledWith(1, "a".repeat(64));
  });
  it("requires a fresh preview after a stale snapshot error", async () => {
    vi.mocked(deleteTodo).mockRejectedValueOnce(new Error("Preview changed"));
    const w = view();
    await flushPromises();
    await openMenu(w, "Quest 1");
    await w
      .get('[aria-label="Quest 1 mit allen Unter-Quests löschen"]')
      .trigger("click");
    await flushPromises();
    await button(w, "Ja, löschen").trigger("click");
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("Preview changed");
    expect(w.find("[role=dialog]").exists()).toBe(false);
  });
  it("offers retry for load errors", async () => {
    vi.mocked(getTodoHierarchy).mockRejectedValueOnce(new Error("Offline"));
    const w = view();
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("Offline");
    await button(w, "Erneut versuchen").trigger("click");
    await flushPromises();
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
  });
  it("shows the empty state", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([]);
    const w = view();
    await flushPromises();
    expect(w.get(".empty-state").text()).toContain("Noch keine Kampagnen.");
    expect(w.get(".empty-state").text()).toContain("Plus-Button");
  });
  it("shows the empty state when there are only loose quests", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { ...node(1, null), title: "Zahnarzt" },
      { ...node(2, null), title: "Einkaufen" },
    ]);
    const w = view();
    await flushPromises();
    expect(w.get(".empty-state").text()).toContain(
      "Quests ohne Kampagne stehen im Questlog.",
    );
    expect(w.find("[data-todo-id]").exists()).toBe(false);
  });
  it("says where a new top-level quest stands until it is a campaign", async () => {
    const w = view();
    await flushPromises();
    await w.get(".create-button").trigger("click");
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      node(1, null, below(1)),
      node(2, 1),
      { ...node(5, null), title: "Neu" },
    ]);
    w.findComponent({ name: "CreateTodoForm" }).vm.$emit("created", {
      ...node(5, null),
      title: "Neu",
    });
    await flushPromises();
    expect(w.get(".status-line").text()).toContain(
      "Sie wird zur Kampagne, sobald sie Unter-Quests",
    );
    expect(w.find('[data-todo-id="5"]').exists()).toBe(false);
  });
  it("creates through the shared plus button", async () => {
    const w = view();
    await flushPromises();
    const plus = w.get(".create-button");
    expect(plus.attributes("aria-label")).toBe("Neue Kampagne");
    expect(w.find(".page-header button").exists()).toBe(false);
    await plus.trigger("click");
    expect(w.find("[role=dialog]").exists()).toBe(true);
  });
  describe("tiles", () => {
    const campaignNode = (
      id: number,
      changes: Partial<HierarchyTodo> = {},
    ): HierarchyTodo => ({ ...node(id, null), title: `Kampagne ${id}`, ...changes });

    beforeEach(() => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        campaignNode(1, {
          color: "berry",
          icon: "book",
          weeklyTargetMinutes: 360,
          progress: below(1),
        }),

        node(2, 1),
        campaignNode(3, { completed: true, color: "moss" }),
        // A loose quest is no campaign and gets no tile.
        { ...node(4, null), title: "Einkaufen" },
      ]);
      vi.mocked(getQuestHours).mockResolvedValue(
        questHours([
          {
            campaign: { id: 1, title: "Kampagne 1", color: "berry", icon: "book" },
            minutes: 210,
            weeklyTargetMinutes: 360,
            weeks: [0, 0, 0, 0, 0, 60, 120, 210],
            totalMinutes: 750,
          },
        ]),
      );
    });

    it("shows a tile per active campaign with its week, trend and total", async () => {
      const w = view();
      await flushPromises();
      const tiles = w.findAll("[data-campaign-tile]");
      expect(tiles.map((tile) => tile.attributes("data-campaign-tile"))).toEqual([
        "1",
      ]);
      const tile = tiles[0]!;
      expect(tile.text()).toContain("Kampagne 1");
      expect(tile.text()).toContain("3 Std. 30 Min. von 6 Std. diese Woche");
      expect(tile.text()).toContain("Insgesamt 12 Std. 30 Min.");
      expect(tile.attributes("style")).toContain("var(--color-mark-berry)");
      expect(tile.get("svg[role=img]").attributes("aria-label")).toContain(
        "Woche ab 16.11.: 3 Std. 30 Min.",
      );
      // The tree below holds the campaigns only; the loose quest is not in it.
      expect(
        w.findAll("[data-todo-id]").map((row) => row.attributes("data-todo-id")),
      ).toEqual(["1", "2", "3"]);
      expect(w.text()).toContain("Kampagnen und ihre Quests");
      expect(w.text()).not.toContain("Einkaufen");
    });

    it("lists completed campaigns under their own tab", async () => {
      const w = view();
      await flushPromises();
      await button(w, "Abgeschlossen").trigger("click");
      const tiles = w.findAll("[data-campaign-tile]");
      expect(tiles.map((tile) => tile.attributes("data-campaign-tile"))).toEqual([
        "3",
      ]);
      // Without measured time the tile says so honestly.
      expect(tiles[0]!.text()).toContain("0 Min. diese Woche");
    });

    it("opens a campaign with its quests, progress and burnup, and goes back", async () => {
      const w = view();
      await flushPromises();
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ kampagne: "1" });
      expect(w.find("[data-campaign-tile]").exists()).toBe(false);
      expect(w.get("#campaign-detail-title").text()).toBe("Kampagne 1");
      expect(w.text()).toContain("Burnup 1");
      // The detail card is the campaign; the tree starts below it.
      const rows = w.findAll("[data-todo-id]");
      expect(rows.map((row) => row.attributes("data-todo-id"))).toEqual(["2"]);
      expect(rows[0]!.attributes("data-depth")).toBe("0");
      expect(w.findAll("[role=progressbar]")).toHaveLength(1);
      expect(
        w.find('[aria-label="Fortschritt von Kampagne 1"]').exists(),
      ).toBe(true);

      await button(w, "Alle Kampagnen").trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({});
      expect(w.findAll("[data-campaign-tile]")).toHaveLength(1);
      expect(w.findAll("[data-todo-id]")).toHaveLength(3);
    });

    it("groups the opened campaign: its Warum, this week, then its progress", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        campaignNode(1, {
          color: "berry",
          weeklyTargetMinutes: 360,
          why: "Damit die Geschichte endlich fertig wird",
          progress: below(3, 1),
        }),
        node(2, 1),
        node(3, 1),
        { ...node(4, 1), completed: true },
      ]);
      const w = view();
      await flushPromises();
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      const card = w.get(".campaign-detail");
      // Top to bottom: name, Warum, "Diese Woche", "Fortschritt", Bearbeiten.
      expect(
        card.element.querySelector(".campaign-detail__head + *")?.textContent?.trim(),
      ).toBe("Damit die Geschichte endlich fertig wird");
      const groups = card.findAll(".campaign-detail__group");
      expect(groups.map((group) => group.get("h3").text())).toEqual([
        "Diese Woche",
        "Fortschritt",
      ]);
      const [week, progress] = groups;
      expect(week!.attributes("aria-labelledby")).toBe("campaign-week-title");
      expect(week!.text()).toContain("3 Std. 30 Min. von 6 Std. Quest-Stunden");
      expect(
        week!.get(".campaign-detail__bar > span").attributes("style"),
      ).toContain("width: 58.3");
      expect(week!.get(".campaign-detail__trend-head").text()).toMatch(
        /^letzte 8 Wochen\s*insgesamt 12 Std\. 30 Min\.$/,
      );
      expect(week!.get("svg[role=img]").attributes("aria-label")).toContain(
        "Quest-Stunden der letzten 8 Wochen.",
      );
      expect(progress!.get(".campaign-detail__count").text()).toBe(
        "1 von 3 Quests · 30 von 90 Min.",
      );
      expect(progress!.find("[role=progressbar]").exists()).toBe(true);
      expect(progress!.get(".burnup-stub").text()).toBe(
        "Burnup 1 beside the bar",
      );
      // Each number once: no second "Verlauf" line or loose total.
      expect(card.text().match(/insgesamt/g)).toHaveLength(1);
      expect(card.findAll("button").at(-1)!.text()).toBe("Bearbeiten");
    });

    it("leaves out what a campaign does not have: no Warum, no goal bar, no progress", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        campaignNode(1, { color: "berry" }),
      ]);
      vi.mocked(getQuestHours).mockResolvedValue(
        questHours([
          {
            campaign: { id: 1, title: "Kampagne 1", color: "berry", icon: null },
            minutes: 45,
            weeklyTargetMinutes: null,
            weeks: [0, 0, 0, 0, 0, 0, 0, 45],
            totalMinutes: 45,
          },
        ]),
      );
      const w = view();
      await flushPromises();
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      const card = w.get(".campaign-detail");
      expect(card.find(".campaign-detail__why").exists()).toBe(false);
      expect(card.find(".campaign-detail__bar").exists()).toBe(false);
      expect(card.text()).toContain("45 Min. Quest-Stunden");
      expect(card.findAll(".campaign-detail__group")).toHaveLength(1);
      expect(card.find(".burnup-stub").exists()).toBe(false);
    });

    it("keeps the campaign's actions on its detail card", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        campaignNode(1, { color: "berry", progress: below(2, 1) }),
        node(2, 1),
        { ...node(3, 1), completed: true },
      ]);
      const w = view();
      await flushPromises();
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      await openMenu(w, "Kampagne 1");
      const trigger = w.get('.campaign-detail [data-menu-trigger="1"]');
      const menu = w.get(`#${trigger.attributes("aria-controls")}`);
      expect(menu.findAll("[role=menuitem]").map((b) => b.text())).toEqual([
        "Kampagne abschließen",
        "Stoppuhr starten",
        "Unter-Quest hinzufügen",
        "Verschieben",
        "Löschen",
      ]);
      // Closing it from here asks like its ring did.
      await w.get('[aria-label="Kampagne 1 abschließen"]').trigger("click");
      await flushPromises();
      expect(w.get("[role=dialog]").text()).toContain(
        "1 Quest in „Kampagne 1“ ist noch offen",
      );
      await w.get("[data-campaign-confirm]").trigger("click");
      await flushPromises();
      expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
      expect(w.get(".undo-toast").text()).toContain("„Kampagne 1“ abgeschlossen");
      expect(
        w.get('.campaign-detail [data-edit-button]').attributes("aria-label"),
      ).toBe("Kampagne Kampagne 1 bearbeiten");
    });

    it("says so when an opened campaign has no quests yet", async () => {
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        campaignNode(1, { color: "berry" }),
      ]);
      const w = view();
      await flushPromises();
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      expect(w.find("[data-todo-id]").exists()).toBe(false);
      expect(w.text()).toContain("Noch keine Quests.");
    });

    it("still opens campaigns when the quest hours cannot be read", async () => {
      vi.mocked(getQuestHours).mockRejectedValue(new Error("Offline"));
      const w = view();
      await flushPromises();
      expect(w.get("[data-campaign-tile]").text()).not.toContain("diese Woche");
      await button(w, "Kampagne 1").trigger("click");
      await flushPromises();
      expect(w.get("#campaign-detail-title").text()).toBe("Kampagne 1");
    });
  });
});
