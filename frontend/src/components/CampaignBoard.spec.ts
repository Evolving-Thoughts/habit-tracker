import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  getBacklogTodos,
  rescheduleTodo,
  setAsideTodo,
  setTodoBlocked,
  startWorkOnTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import { createTimerController, timerKey } from "../composables/useTimer";
import { useWrites } from "../composables/useWrites";
import { hierarchyTodo } from "../test/hierarchy";
import { TODO_FIELDS } from "../types/fixtures";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import CampaignBoard from "./CampaignBoard.vue";
import CampaignBoardColumn from "./CampaignBoardColumn.vue";

vi.mock("../api/day-planner.api", () => ({
  getBacklogTodos: vi.fn(),
  rescheduleTodo: vi.fn(),
  setAsideTodo: vi.fn(),
  startWorkOnTodo: vi.fn(),
  setTodoBlocked: vi.fn(),
  updateTodoCompletion: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  rescheduleOccurrence: vi.fn(),
}));
/* SortableJS stands in: its handlers per list, to play a long press. */
type SortableHandlers = {
  onChoose: (event: { item: HTMLElement; originalEvent?: Event }) => void;
  onUnchoose: (event: { item: HTMLElement }) => void;
};
const sortables = vi.hoisted(() => new Map<HTMLElement, unknown>());
vi.mock("sortablejs", () => ({
  default: {
    create: (element: HTMLElement, options: unknown) => {
      sortables.set(element, options);
      return { destroy: () => undefined };
    },
  },
}));
vi.mock("../api/questlog.api", () => ({
  planQuest: vi.fn(),
  unplanQuest: vi.fn(),
}));

enableAutoUnmount(afterEach);

const TODAY = "2026-11-27";
const campaign = hierarchyTodo({
  id: 1,
  title: "Buch",
  color: "pine",
  categoryId: 11,
});
const series = hierarchyTodo({ id: 2, title: "Kapitel 1", parentId: 1 });
const quest = (
  id: number,
  changes: Partial<HierarchyTodo> = {},
): HierarchyTodo =>
  hierarchyTodo({ id, title: `Quest ${id}`, parentId: 1, ...changes });

/** To-Do, Geplant, In Arbeit and Erledigt, one card each, and a Questreihe. */
const TODOS = [
  campaign,
  series,
  quest(3, { parentId: 2, title: "Entwurf" }),
  quest(4, { scheduledDate: "2026-11-28", plannedDurationMinutes: 30 }),
  quest(5, { inProgress: true }),
  quest(6, { completed: true, completedAt: "2026-11-26T10:00:00.000Z" }),
];

const ticks = {
  complete: vi.fn(),
  reopen: vi.fn(),
};
/* The view's row dialogs: the board only asks for them. */
const dialogs = {
  edit: vi.fn(),
  reparent: vi.fn(),
  remove: vi.fn(),
};
const ModalStub = {
  name: "ModalDialog",
  props: ["title"],
  emits: ["close"],
  template: '<section role="dialog" :aria-label="title"><slot /></section>',
};
const QuickAddStub = {
  name: "QuickAddQuest",
  props: ["date", "parent", "label", "column", "placeToggle"],
  emits: ["created"],
  template: '<form class="quick-add-stub" :aria-label="label" />',
};

function mountBoard(
  todos: HierarchyTodo[] = TODOS,
  busy = false,
  /** What the reload after a write brings, like the view's loader. */
  reloaded?: () => HierarchyTodo[],
) {
  const writes = useWrites(async () => {
    if (reloaded) await wrapper.setProps({ todos: reloaded() });
  }, ref<string | null>(null));
  const wrapper = mount(CampaignBoard, {
    props: { todos, campaign, busy, writes, ticks, dialogs },
    global: { stubs: { ModalDialog: ModalStub, QuickAddQuest: QuickAddStub } },
  });
  return wrapper;
}
type Board = ReturnType<typeof mountBoard>;

const column = (w: Board, key: string) =>
  w.get(`[data-board-column="${key}"]`);
const titles = (w: Board, key: string) =>
  column(w, key)
    .findAll("[data-todo-id] h4")
    .map((heading) => heading.attributes("aria-label"));
async function openMenu(w: Board, title: string) {
  await w
    .get(`[aria-label="Aktionen für ${title}"][aria-haspopup]`)
    .trigger("click");
}
const entries = (w: Board) =>
  w.findAll("[role=menuitem]").map((entry) => entry.text());
async function choose(w: Board, label: string) {
  await w
    .findAll("[role=menuitem]")
    .find((entry) => entry.text() === label)!
    .trigger("click");
  await flushPromises();
}
const buttonByText = (w: Board, text: string) =>
  w.findAll("button").find((button) => button.text() === text)!;
/** A drop as SortableJS reports it: a card of column `from` landed on `to`. */
async function drop(w: Board, from: string, todoId: number, to: string) {
  const source = w
    .findAllComponents(CampaignBoardColumn)
    .find((item) => item.props("column") === from)!;
  source.vm.$emit("move", todoId, to);
  await flushPromises();
}

describe("CampaignBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
    vi.mocked(getBacklogTodos).mockResolvedValue([]);
    vi.mocked(planQuest).mockResolvedValue({} as never);
    vi.mocked(unplanQuest).mockResolvedValue({} as never);
    vi.mocked(rescheduleTodo).mockResolvedValue({} as never);
    vi.mocked(setAsideTodo).mockResolvedValue({} as never);
    vi.mocked(startWorkOnTodo).mockResolvedValue({} as never);
    vi.mocked(setTodoBlocked).mockResolvedValue({} as never);
    vi.mocked(updateTodoCompletion).mockResolvedValue();
    ticks.complete.mockResolvedValue(true);
    ticks.reopen.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it("shows a quest in In Arbeit as soon as its stopwatch runs, and asks the server when it ends", async () => {
    const controller = createTimerController();
    const writes = useWrites(async () => {}, ref<string | null>(null));
    const w = mount(CampaignBoard, {
      props: { todos: TODOS, campaign, busy: false, writes, ticks, dialogs },
      global: {
        stubs: { ModalDialog: ModalStub, QuickAddQuest: QuickAddStub },
        provide: { [timerKey as symbol]: controller },
      },
    });
    expect(titles(w, "planned")).toEqual(["Quest 4"]);
    controller.timer.value = {
      kind: "todo",
      targetId: 4,
      state: "running",
    } as never;
    await flushPromises();
    expect(titles(w, "planned")).toEqual([]);
    expect(titles(w, "working")).toContain("Quest 4");
    expect(w.emitted("changed")).toBeUndefined();

    controller.timer.value = null;
    await flushPromises();
    expect(w.emitted("changed")).toHaveLength(1);
    controller.dispose();
  });

  it("shows four named columns, each with its count in its name", async () => {
    const w = mountBoard();
    await flushPromises();
    const columns = w.findAll("[data-board-column]");
    expect(columns.map((item) => item.get("h3").text())).toEqual([
      "To-Do",
      "Geplant",
      "In Arbeit",
      "Erledigt",
    ]);
    expect(columns.map((item) => item.attributes("aria-label"))).toEqual([
      "To-Do, 1 Quest",
      "Geplant, 1 Quest",
      "In Arbeit, 1 Quest",
      "Erledigt, 1 Quest",
    ]);
    expect(titles(w, "todo")).toEqual(["Entwurf"]);
    expect(titles(w, "planned")).toEqual(["Quest 4"]);
    expect(titles(w, "working")).toEqual(["Quest 5"]);
    expect(titles(w, "done")).toEqual(["Quest 6"]);
  });

  it("never makes the campaign or a Questreihe a card, and names the Questreihe", async () => {
    const w = mountBoard();
    await flushPromises();
    expect(w.text()).not.toContain("Kapitel 1 bearbeiten");
    const card = w.get('[data-todo-id="3"]');
    expect(card.text()).toContain("Kapitel 1");
    expect(card.get(".board-column__series").text()).toBe("Questreihe Kapitel 1");
    expect(w.get('[data-todo-id="4"]').find(".board-column__series").exists()).toBe(
      false,
    );
  });

  it("says a card's day and planned time in words", async () => {
    const w = mountBoard();
    await flushPromises();
    expect(w.get('[data-todo-id="4"]').text()).toContain("Morgen");
    expect(w.get('[data-todo-id="4"]').text()).toContain("30 Min.");
  });

  it("marks a blocked card with a sign and the word, never colour alone", async () => {
    const w = mountBoard([campaign, quest(3, { blocked: true })]);
    await flushPromises();
    const marker = w.get('[data-todo-id="3"] .board-column__blocked');
    expect(marker.text()).toBe("Geblockt");
    expect(marker.find("svg").exists()).toBe(true);
  });

  it("sorts To-Do in the Questlog's order", async () => {
    vi.mocked(getBacklogTodos).mockResolvedValue([
      { ...TODO_FIELDS, id: 8 },
      { ...TODO_FIELDS, id: 7 },
    ] as never);
    const w = mountBoard([campaign, quest(7), quest(8)]);
    await flushPromises();
    expect(titles(w, "todo")).toEqual(["Quest 8", "Quest 7"]);
  });

  it("says in each empty column why it is empty, In Arbeit how it fills", async () => {
    const w = mountBoard([campaign]);
    await flushPromises();
    expect(column(w, "todo").text()).toContain("Keine offenen Quests ohne Tag.");
    expect(column(w, "working").text()).toContain(
      "Zieh hierher, woran du arbeitest.",
    );
  });

  it("puts the quick add on To-Do and Geplant, below the campaign", async () => {
    const w = mountBoard();
    await flushPromises();
    const fields = w.findAllComponents(QuickAddStub);
    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.props("date"))).toEqual([null, TODAY]);
    for (const field of fields)
      expect(field.props("parent")).toEqual({ id: 1, categoryId: 11 });
    fields[0]!.vm.$emit("created");
    expect(w.emitted("changed")).toHaveLength(1);
  });

  it("shows the newest 20 done quests and the rest behind a quiet button", async () => {
    const done = Array.from({ length: 23 }, (_, index) =>
      quest(10 + index, {
        completed: true,
        completedAt: `2026-11-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const w = mountBoard([campaign, ...done]);
    await flushPromises();
    expect(titles(w, "done")).toHaveLength(20);
    expect(titles(w, "done")[0]).toBe("Quest 32");
    expect(column(w, "done").attributes("aria-label")).toBe(
      "Erledigt, 23 Quests",
    );
    await buttonByText(w, "Ältere zeigen (3)").trigger("click");
    expect(titles(w, "done")).toHaveLength(23);
  });

  describe("the menu of a card", () => {
    it("offers the day steps, Erledigen and Geblockt for a quest in To-Do", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Entwurf");
      expect(entries(w)).toEqual([
        "Heute",
        "Morgen",
        "Nächste Woche",
        "Anderer Tag …",
        "Erledigen",
        "In Arbeit nehmen",
        "Als geblockt markieren",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Löschen",
      ]);
    });

    it("plans a quest of To-Do for today without asking", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Entwurf");
      await choose(w, "Heute");
      expect(w.find("[role=dialog]").exists()).toBe(false);
      expect(planQuest).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3 }),
        TODAY,
      );
      expect(setAsideTodo).not.toHaveBeenCalled();
    });

    it("moves a planned quest to another day and back into To-Do", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Quest 4");
      expect(entries(w)).toContain("Zurück ins To-Do");
      await choose(w, "Heute");
      expect(rescheduleTodo).toHaveBeenCalledWith(4, TODAY, true);
      await openMenu(w, "Quest 4");
      await choose(w, "Zurück ins To-Do");
      expect(unplanQuest).toHaveBeenCalledWith(4);
    });

    it("completes through the ring's path, with its undo toast", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Entwurf");
      await choose(w, "Erledigen");
      expect(ticks.complete).toHaveBeenCalledWith(
        { kind: "todo", targetId: 3, title: "Entwurf" },
        expect.objectContaining({ key: "board-3" }),
      );
    });

    it("marks a quest as blocked and lifts the blocker", async () => {
      const w = mountBoard([campaign, quest(3), quest(4, { blocked: true })]);
      await flushPromises();
      await openMenu(w, "Quest 3");
      await choose(w, "Als geblockt markieren");
      expect(setTodoBlocked).toHaveBeenCalledWith(3, true);
      await openMenu(w, "Quest 4");
      await choose(w, "Blocker aufheben");
      expect(setTodoBlocked).toHaveBeenCalledWith(4, false);
    });

    it("sets a quest in work aside after asking whether it is blocked", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Quest 5");
      expect(entries(w)).toContain("Zurückstellen …");
      // There the blocked question comes with "Zurückstellen …".
      expect(entries(w)).not.toContain("Als geblockt markieren");
      await choose(w, "Zurückstellen …");
      expect(w.get('[role=dialog]').attributes("aria-label")).toBe(
        "Als geblockt markieren?",
      );
      await buttonByText(w, "Ja, geblockt").trigger("click");
      await flushPromises();
      expect(setAsideTodo).toHaveBeenCalledWith(5, true);
      expect(unplanQuest).not.toHaveBeenCalled();
      expect(planQuest).not.toHaveBeenCalled();
    });

    it("lifts the blocker of a quest in work from its menu", async () => {
      const w = mountBoard([
        campaign,
        quest(5, { inProgress: true, blocked: true }),
      ]);
      await flushPromises();
      await openMenu(w, "Quest 5");
      await choose(w, "Blocker aufheben");
      expect(setTodoBlocked).toHaveBeenCalledWith(5, false);
    });

    it("leaves a done quest only the ways back, editing and deleting", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Quest 6");
      expect(entries(w)).toEqual([
        "Anderer Tag …",
        "Zurück ins To-Do",
        "In Arbeit nehmen",
        "Bearbeiten",
        "In Kampagne verschieben …",
        "Löschen",
      ]);
    });

    it("opens the view's editor, campaign move and delete dialogs", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Entwurf");
      await choose(w, "Bearbeiten");
      await openMenu(w, "Entwurf");
      await choose(w, "In Kampagne verschieben …");
      await openMenu(w, "Entwurf");
      await choose(w, "Löschen");
      expect(dialogs.edit).toHaveBeenCalledWith("todo-3", { kind: "todo", id: 3 });
      expect(dialogs.reparent).toHaveBeenCalledWith("todo-3", {
        todoId: 3,
        title: "Entwurf",
      });
      expect(dialogs.remove).toHaveBeenCalledWith("todo-3", {
        kind: "todo",
        id: 3,
        title: "Entwurf",
      });
    });
  });

  describe("a drop on another column", () => {
    it("asks the day for Geplant and plans only once one is chosen", async () => {
      const w = mountBoard();
      await flushPromises();
      await drop(w, "todo", 3, "planned");
      expect(w.get('[role=dialog]').attributes("aria-label")).toBe("Einplanen");
      expect(planQuest).not.toHaveBeenCalled();
      await buttonByText(w, "Morgen").trigger("click");
      await flushPromises();
      expect(planQuest).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3 }),
        "2026-11-28",
      );
    });

    it("leaves the card where it was when the day question is cancelled", async () => {
      const w = mountBoard();
      await flushPromises();
      await drop(w, "todo", 3, "planned");
      await buttonByText(w, "Abbrechen").trigger("click");
      await flushPromises();
      expect(w.find("[role=dialog]").exists()).toBe(false);
      expect(planQuest).not.toHaveBeenCalled();
      expect(titles(w, "todo")).toEqual(["Entwurf"]);
    });

    it("takes quests into In Arbeit by hand, several at once, without a stopwatch", async () => {
      const w = mountBoard();
      await flushPromises();
      await drop(w, "todo", 3, "working");
      await drop(w, "planned", 4, "working");
      expect(w.find("[role=dialog]").exists()).toBe(false);
      expect(vi.mocked(startWorkOnTodo).mock.calls).toEqual([[3], [4]]);
      expect(planQuest).not.toHaveBeenCalled();
      expect(updateTodoCompletion).not.toHaveBeenCalled();
    });

    it("opens a done quest again before it goes into In Arbeit", async () => {
      const w = mountBoard();
      await flushPromises();
      await drop(w, "done", 6, "working");
      expect(updateTodoCompletion).toHaveBeenCalledWith(6, false);
      expect(startWorkOnTodo).toHaveBeenCalledWith(6);
    });

    it("offers In Arbeit nehmen in the menu of a card outside In Arbeit", async () => {
      const w = mountBoard();
      await flushPromises();
      await openMenu(w, "Quest 5");
      expect(entries(w)).not.toContain("In Arbeit nehmen");
      await openMenu(w, "Entwurf");
      await choose(w, "In Arbeit nehmen");
      expect(startWorkOnTodo).toHaveBeenCalledWith(3);
    });

    it("asks whether a quest out of In Arbeit is blocked; no answer, no move", async () => {
      const w = mountBoard([campaign, quest(5, { inProgress: true, scheduledDate: TODAY })]);
      await flushPromises();
      await drop(w, "working", 5, "todo");
      expect(w.get('[role=dialog]').attributes("aria-label")).toBe(
        "Als geblockt markieren?",
      );
      w.findComponent(ModalStub).vm.$emit("close");
      await flushPromises();
      expect(setAsideTodo).not.toHaveBeenCalled();
      expect(titles(w, "working")).toEqual(["Quest 5"]);

      await drop(w, "working", 5, "todo");
      await buttonByText(w, "Nein, nur zurückstellen").trigger("click");
      await flushPromises();
      expect(setAsideTodo).toHaveBeenCalledWith(5, false);
      expect(unplanQuest).toHaveBeenCalledWith(5);
    });

    it("shows the move at once, before the server answers", async () => {
      let answer!: () => void;
      vi.mocked(unplanQuest).mockReturnValue(
        new Promise((resolve) => (answer = () => resolve({} as never))),
      );
      const w = mountBoard();
      await flushPromises();
      await drop(w, "planned", 4, "todo");
      expect(titles(w, "todo")).toEqual(["Entwurf", "Quest 4"]);
      expect(w.get(".campaign-board__status").text()).toBe(
        "„Quest 4“ steht jetzt in To-Do.",
      );
      answer();
      await flushPromises();
    });

    it("takes the move back when the server refuses it", async () => {
      vi.mocked(unplanQuest).mockRejectedValue(new Error("Offline"));
      const w = mountBoard();
      await flushPromises();
      await drop(w, "planned", 4, "todo");
      expect(titles(w, "planned")).toEqual(["Quest 4"]);
      expect(w.get(".campaign-board__status").text()).toBe("");
    });
  });

  describe("marking several cards", () => {
    // A press ends the pause after a long press (`noteDragEnd`), as in use.
    afterEach(() => document.dispatchEvent(new PointerEvent("pointerdown")));
    const card = (w: Board, id: number) => w.get(`[data-todo-id="${id}"]`);
    const marked = (w: Board) =>
      w
        .findAll("[data-todo-id][data-selected]")
        .map((item) => Number(item.attributes("data-todo-id")));
    async function ctrlClick(w: Board, id: number) {
      await card(w, id).get(".item-row__content").trigger("click", {
        ctrlKey: true,
      });
    }
    async function tap(w: Board, id: number) {
      const body = card(w, id).get(".item-row__content");
      body.element.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
      );
      // What reaches the page in use; the board is not attached here.
      document.dispatchEvent(new PointerEvent("pointerdown"));
      await body.trigger("click");
    }
    /** A finger held the card long enough to lift it and let go in place. */
    async function hold(w: Board, column: string, id: number) {
      const list = w.get(`[data-column="${column}"]`).element as HTMLElement;
      const handlers = sortables.get(list) as SortableHandlers;
      const item = card(w, id).element as HTMLElement;
      handlers.onChoose({
        item,
        originalEvent: new PointerEvent("pointerdown", { pointerType: "touch" }),
      });
      handlers.onUnchoose({ item });
      await flushPromises();
    }

    it("marks and unmarks a card with Ctrl-click, without opening its editor", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      expect(dialogs.edit).not.toHaveBeenCalled();
      expect(marked(w)).toEqual([3]);
      // Said in words and with a sign, never by the frame alone.
      const state = card(w, 3).get(".board-column__selected");
      expect(state.text()).toBe("Ausgewählt");
      expect(state.find("svg").exists()).toBe(true);
      const line = w.get(".campaign-board__selection-count");
      expect(line.attributes("role")).toBe("status");
      expect(line.text()).toContain("1 ausgewählt");
      await card(w, 4)
        .get(".item-row__content")
        .trigger("click", { metaKey: true });
      expect(marked(w)).toEqual([3, 4]);
      expect(card(w, 3).attributes("data-travel")).toBe("2 Karten");
      await ctrlClick(w, 3);
      expect(marked(w)).toEqual([4]);
    });

    it("leaves a plain click as it was: it opens the editor", async () => {
      const w = mountBoard();
      await flushPromises();
      await card(w, 3).get(".item-row__content").trigger("click");
      expect(dialogs.edit).toHaveBeenCalledWith("todo-3", { kind: "todo", id: 3 });
      expect(marked(w)).toEqual([]);
    });

    it("marks by a long press, then by taps, on a touch screen", async () => {
      const w = mountBoard();
      await flushPromises();
      // Without marks a tap edits as always.
      await tap(w, 4);
      expect(dialogs.edit).toHaveBeenCalledTimes(1);
      await hold(w, "todo", 3);
      expect(marked(w)).toEqual([3]);
      await tap(w, 4);
      expect(marked(w)).toEqual([3, 4]);
      expect(dialogs.edit).toHaveBeenCalledTimes(1);
      // The card's own controls keep their tap.
      await openMenu(w, "Quest 4");
      expect(entries(w)).toContain("Bearbeiten");
    });

    it("moves every marked card by its own rule, asking each question once", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3); // To-Do: needs a day
      await ctrlClick(w, 4); // already in Geplant: stays
      await ctrlClick(w, 5); // In Arbeit: blocked, then a day
      await drop(w, "todo", 3, "planned");

      expect(w.findAll("[role=dialog]")).toHaveLength(1);
      expect(w.get("[role=dialog]").attributes("aria-label")).toBe(
        "Als geblockt markieren?",
      );
      await buttonByText(w, "Ja, geblockt").trigger("click");
      await flushPromises();
      expect(w.get("[role=dialog]").attributes("aria-label")).toBe(
        "2 Quests einplanen",
      );
      expect(planQuest).not.toHaveBeenCalled();
      expect(setAsideTodo).not.toHaveBeenCalled();
      await buttonByText(w, "Morgen").trigger("click");
      await flushPromises();

      expect(w.find("[role=dialog]").exists()).toBe(false);
      expect(
        vi.mocked(planQuest).mock.calls.map(([todo, day]) => [todo.id, day]),
      ).toEqual([
        [3, "2026-11-28"],
        [5, "2026-11-28"],
      ]);
      expect(setAsideTodo).toHaveBeenCalledTimes(1);
      expect(setAsideTodo).toHaveBeenCalledWith(5, true);
      expect(rescheduleTodo).not.toHaveBeenCalled();
      expect(marked(w)).toEqual([]);
    });

    it("moves nothing when a question of the group goes unanswered", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      await ctrlClick(w, 5);
      await drop(w, "working", 5, "planned");
      w.findComponent(ModalStub).vm.$emit("close");
      await flushPromises();
      expect(setAsideTodo).not.toHaveBeenCalled();
      expect(planQuest).not.toHaveBeenCalled();
      expect(marked(w)).toEqual([3, 5]);
    });

    it("asks once whether several quests out of In Arbeit are blocked", async () => {
      const w = mountBoard([
        campaign,
        quest(5, { inProgress: true }),
        quest(7, { inProgress: true }),
      ]);
      await flushPromises();
      await ctrlClick(w, 5);
      await ctrlClick(w, 7);
      await drop(w, "working", 7, "todo");
      expect(w.findAll("[role=dialog]")).toHaveLength(1);
      expect(w.get("[role=dialog]").text()).toContain(
        "2 Quests kommen aus In Arbeit zurück",
      );
      await buttonByText(w, "Nein, nur zurückstellen").trigger("click");
      await flushPromises();
      expect(vi.mocked(setAsideTodo).mock.calls).toEqual([
        [7, false],
        [5, false],
      ]);
    });

    it("completes each marked card through the path of the ring", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      await ctrlClick(w, 4);
      await drop(w, "planned", 4, "done");
      expect(ticks.complete.mock.calls.map(([target]) => target.targetId)).toEqual([
        4, 3,
      ]);
    });

    it("says how many quests now stand in the column", async () => {
      const after = [
        campaign,
        series,
        quest(3, { parentId: 2, title: "Entwurf", inProgress: true }),
        quest(4, { scheduledDate: "2026-11-28", inProgress: true }),
        quest(5, { inProgress: true }),
        quest(6, { completed: true, completedAt: "2026-11-26T10:00:00.000Z" }),
      ];
      const w = mountBoard(TODOS, false, () => after);
      await flushPromises();
      await ctrlClick(w, 3);
      await ctrlClick(w, 4);
      await drop(w, "todo", 3, "working");
      expect(vi.mocked(startWorkOnTodo).mock.calls).toEqual([[3], [4]]);
      expect(w.get(".campaign-board__status").text()).toBe(
        "2 Quests stehen jetzt in In Arbeit.",
      );
    });

    it("moves an unmarked card alone and leaves the marks be", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      await drop(w, "planned", 4, "todo");
      expect(unplanQuest).toHaveBeenCalledTimes(1);
      expect(unplanQuest).toHaveBeenCalledWith(4);
      expect(planQuest).not.toHaveBeenCalled();
      expect(marked(w)).toEqual([3]);
    });

    it("lets go of the mark at once when the only marked card moves", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      await drop(w, "todo", 3, "planned");
      expect(w.get("[role=dialog]").attributes("aria-label")).toBe("Einplanen");
      expect(marked(w)).toEqual([]);
    });

    it("lets go of the marks with Auswahl aufheben and with Escape", async () => {
      const w = mountBoard();
      await flushPromises();
      await ctrlClick(w, 3);
      await ctrlClick(w, 4);
      await buttonByText(w, "Auswahl aufheben").trigger("click");
      expect(marked(w)).toEqual([]);
      expect(w.find(".campaign-board__selection button").exists()).toBe(false);
      await ctrlClick(w, 3);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();
      expect(marked(w)).toEqual([]);
    });
  });
});
