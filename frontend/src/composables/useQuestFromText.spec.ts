import { HIERARCHY_FIELDS, TODO_FIELDS } from "../types/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory } from "../api/categories.api";
import { createTodo } from "../api/day-planner.api";
import { NewPlaceError } from "../api/new-places.api";
import type { TodoResponse } from "../types/todo";
import { colorOfName } from "../utils/category-mark";
import type { QuestParse } from "../utils/quest-parse";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import type { ParentChoice } from "../utils/parent-choice";
import {
  fieldsFromText,
  newPlaces,
  placeFromText,
  questDay,
  textCategory,
  useQuestFromText,
  type QuestFromText,
  type QuestTextFields,
} from "./useQuestFromText";

vi.mock("../api/day-planner.api", () => ({ createTodo: vi.fn() }));
vi.mock("../api/categories.api", () => ({ createCategory: vi.fn() }));

const parse = (fields: Partial<QuestParse> = {}): QuestParse => ({
  title: "Kisten packen",
  matches: [],
  ...fields,
});

const todo = (id: number, title: string): TodoResponse => ({
  ...TODO_FIELDS,
  id,
  parentId: null,
  title,
  completed: false,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: null,
  timerEligible: true,
});

describe("questDay", () => {
  // Tuesday, 24 Nov 2026, in Berlin.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("takes the day the text names over the field's", () => {
    expect(questDay(parse({ scheduledDate: "2026-11-25" }), "2026-11-30")).toBe(
      "2026-11-25",
    );
  });

  it("keeps the field's day, or none, when the text names no day", () => {
    expect(questDay(parse({ plannedDurationMinutes: 30 }), "2026-11-30")).toBe(
      "2026-11-30",
    );
    expect(questDay(parse())).toBeNull();
  });

  it("makes a time without a day an appointment today, or on the field's day", () => {
    expect(questDay(parse({ timeOfDay: "13:00" }))).toBe("2026-11-24");
    expect(questDay(parse({ timeOfDay: "13:00" }), "2026-11-30")).toBe(
      "2026-11-30",
    );
  });
});

describe("textCategory", () => {
  const categories: Record<number, number | null> = { 1: 11, 2: null };
  const campaignCategory = (id: number) => categories[id] ?? null;

  it("lets a named campaign lend its category", () => {
    expect(textCategory(parse({ campaignId: 1 }), campaignCategory)).toBe(11);
  });

  it("takes a named category over the campaign's", () => {
    expect(
      textCategory(parse({ campaignId: 1, categoryId: 10 }), campaignCategory),
    ).toBe(10);
  });

  it("knows no id for a new category yet, even beside a campaign", () => {
    expect(
      textCategory(
        parse({ campaignId: 1, newCategory: "Haushalt" }),
        campaignCategory,
      ),
    ).toBeNull();
  });

  it("gives none for a campaign without a category", () => {
    expect(textCategory(parse({ campaignId: 2 }), campaignCategory)).toBeNull();
  });

  it("gives nothing when the text names neither", () => {
    expect(textCategory(parse(), campaignCategory)).toBeUndefined();
  });
});

describe("placeFromText", () => {
  const categories: Record<number, number | null> = { 1: 11, 2: null };
  const campaignCategory = (id: number) => categories[id] ?? null;
  const own = { parentId: 9, categoryId: 4 };
  const created = {
    campaign: todo(30, "Umzug"),
    category: { id: 40, name: "Haushalt", color: "pine" },
  };

  it.each([
    ["keeps the form's place and category", parse(), {}, own],
    ["takes a named category over the form's", parse({ categoryId: 10 }), {}, { parentId: 9, categoryId: 10 }],
    ["moves below a named campaign with its category", parse({ campaignId: 1 }), {}, { parentId: 1, categoryId: 11 }],
    ["gives none for a named campaign without one", parse({ campaignId: 2 }), {}, { parentId: 2, categoryId: null }],
    ["takes a named category over the campaign's", parse({ campaignId: 1, categoryId: 10 }), {}, { parentId: 1, categoryId: 10 }],
    ["moves below a new campaign, leaving the category out", parse({ newCampaign: "Umzug" }), { campaign: created.campaign }, { parentId: 30, categoryId: undefined }],
    ["takes a new category once created", parse({ newCategory: "Haushalt" }), { category: created.category }, { parentId: 9, categoryId: 40 }],
  ])("%s", (_, result, places, place) => {
    expect(placeFromText(result, own, campaignCategory, places)).toEqual(place);
  });

  it("gives nothing where neither the text nor the form has a place", () => {
    expect(placeFromText(parse(), {}, campaignCategory)).toEqual({
      parentId: undefined,
      categoryId: undefined,
    });
  });
});

describe("fieldsFromText", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const campaign = (id: number, categoryId: number | null): HierarchyTodo => ({
    ...todo(id, `Kampagne ${id}`),
    ...HIERARCHY_FIELDS,
    categoryId,
    why: `Warum ${id}`,
    progress: {
      mode: "count",
      completed: 0,
      total: 0,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 0,
      doneCount: 0,
    },
  });
  const choices: Record<number, ParentChoice> = Object.fromEntries(
    [campaign(1, 11), campaign(2, null)].map((entry) => [
      entry.id,
      { todo: entry, path: [entry.title], campaign: entry },
    ]),
  );
  const names = {
    campaign: (id: number) => choices[id],
    campaignCategory: (id: number) => choices[id]?.todo.categoryId ?? null,
  };
  const untouched = {
    date: false,
    time: false,
    duration: false,
    campaign: false,
    category: false,
  };
  const own: QuestTextFields = {
    date: "2026-11-30",
    time: "08:00",
    duration: 15,
    parentId: 9,
    inheritedWhy: null,
    categoryId: 4,
  };
  const why1 = { text: "Warum 1", fromId: 1, fromTitle: "Kampagne 1" };

  it("shows the form's own values without a parse", () => {
    expect(fieldsFromText(own, null, untouched, names)).toEqual(own);
  });

  it("fills untouched fields from the text, else empties all but the category", () => {
    expect(
      fieldsFromText(
        own,
        parse({ scheduledDate: "2026-11-25", plannedDurationMinutes: 30, campaignId: 1 }),
        untouched,
        names,
      ),
    ).toEqual({
      date: "2026-11-25",
      time: "",
      duration: 30,
      parentId: 1,
      inheritedWhy: why1,
      categoryId: 11,
    });
    expect(fieldsFromText(own, parse(), untouched, names)).toEqual({
      date: "",
      time: "",
      duration: "",
      parentId: null,
      inheritedWhy: null,
      categoryId: 4,
    });
  });

  it("makes a time without a day an appointment today", () => {
    expect(
      fieldsFromText(own, parse({ timeOfDay: "13:00" }), untouched, names),
    ).toMatchObject({ date: "2026-11-24", time: "13:00" });
  });

  it("keeps every field set by hand", () => {
    const touched = {
      date: true,
      time: true,
      duration: true,
      campaign: true,
      category: true,
    };
    expect(
      fieldsFromText(
        own,
        parse({ scheduledDate: "2026-11-25", timeOfDay: "13:00", plannedDurationMinutes: 30, campaignId: 1, categoryId: 10 }),
        touched,
        names,
      ),
    ).toEqual(own);
  });

  it.each([
    ["a named category over the own", parse({ categoryId: 10 }), 10],
    ["a named campaign's category over the own", parse({ campaignId: 1 }), 11],
    ["none for a named campaign without one", parse({ campaignId: 2 }), null],
    ["none for a new category, pending until saving", parse({ newCategory: "Haushalt" }), null],
    ["the own one beside a new campaign", parse({ newCampaign: "Umzug" }), 4],
  ])("shows %s", (_, result, categoryId) => {
    expect(fieldsFromText(own, result, untouched, names).categoryId).toBe(
      categoryId,
    );
  });

  it("keeps a category picked by hand over a named campaign's", () => {
    expect(
      fieldsFromText(
        own,
        parse({ campaignId: 1 }),
        { ...untouched, category: true },
        names,
      ),
    ).toMatchObject({ parentId: 1, categoryId: 4 });
  });
});

describe("newPlaces", () => {
  it("lists the new names the text holds, none without a parse", () => {
    expect(
      newPlaces(parse({ newCategory: "Haushalt", newCampaign: "Umzug" })),
    ).toEqual({ category: "Haushalt", campaign: "Umzug" });
    expect(newPlaces(null)).toEqual({
      category: undefined,
      campaign: undefined,
    });
  });
});

describe("useQuestFromText", () => {
  const changed = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    window.addEventListener("timer-data-changed", changed);
  });
  afterEach(() => window.removeEventListener("timer-data-changed", changed));

  const plan = (
    places: QuestFromText["places"],
    campaignCategoryId: number | null = null,
  ) => {
    const input = vi.fn((created: Parameters<QuestFromText["input"]>[0]) => ({
      title: "Kisten packen",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      parentId: created.campaign?.id ?? null,
      categoryId: created.category?.id ?? null,
    }));
    return { places, campaignCategoryId, input };
  };

  it("creates only the quest when nothing is new, and announces nothing", async () => {
    vi.mocked(createTodo).mockResolvedValue(todo(7, "Kisten packen"));
    const learn = vi.fn();
    const wanted = plan(newPlaces(parse()));
    const created = await useQuestFromText({ learn }).create(wanted);
    expect(created.id).toBe(7);
    expect(wanted.input).toHaveBeenCalledWith({});
    expect(createTodo).toHaveBeenCalledTimes(1);
    expect(createCategory).not.toHaveBeenCalled();
    expect(learn).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("creates the category, then the campaign with it, then the quest below both", async () => {
    const category = { id: 12, name: "Haushalt" };
    vi.mocked(createCategory).mockResolvedValue(category);
    vi.mocked(createTodo)
      .mockResolvedValueOnce(todo(40, "Umzug"))
      .mockResolvedValueOnce(todo(7, "Kisten packen"));
    const learn = vi.fn();
    await useQuestFromText({ learn }).create(
      plan({ category: "Haushalt", campaign: "Umzug" }, 10),
    );
    expect(createCategory).toHaveBeenCalledWith("Haushalt");
    expect(createTodo).toHaveBeenNthCalledWith(1, {
      title: "Umzug",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      color: colorOfName("Umzug"),
      categoryId: 12,
    });
    expect(createTodo).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ parentId: 40, categoryId: 12 }),
    );
    expect(learn).toHaveBeenCalledTimes(1);
    expect(learn).toHaveBeenCalledWith({
      category,
      campaign: todo(40, "Umzug"),
    });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("gives a new campaign the existing category it is handed", async () => {
    vi.mocked(createTodo)
      .mockResolvedValueOnce(todo(40, "Umzug"))
      .mockResolvedValueOnce(todo(7, "Kisten packen"));
    await useQuestFromText().create(plan({ campaign: "Umzug" }, 10));
    expect(createTodo).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: "Umzug", categoryId: 10 }),
    );
  });

  it("creates no quest when the campaign fails, but tells what was created", async () => {
    const category = { id: 12, name: "Haushalt" };
    vi.mocked(createCategory).mockResolvedValue(category);
    vi.mocked(createTodo).mockRejectedValueOnce(new Error("Offline"));
    const learn = vi.fn();
    const wanted = plan({ category: "Haushalt", campaign: "Umzug" });
    const attempt = useQuestFromText({ learn }).create(wanted);
    await expect(attempt).rejects.toThrow(NewPlaceError);
    await expect(attempt).rejects.toThrow(
      "Die Kampagne „Umzug“ konnte nicht angelegt werden, die Quest ist nicht erstellt. Offline",
    );
    expect(createTodo).toHaveBeenCalledTimes(1);
    expect(wanted.input).not.toHaveBeenCalled();
    expect(learn).toHaveBeenCalledWith({ category });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("creates the category only once across a retry after the campaign failed", async () => {
    const category = { id: 12, name: "Haushalt" };
    vi.mocked(createCategory).mockResolvedValue(category);
    vi.mocked(createTodo).mockRejectedValueOnce(new Error("Offline"));
    const quest = useQuestFromText();
    const wanted = { category: "Haushalt", campaign: "Umzug" };
    await expect(quest.create(plan(wanted))).rejects.toThrow();

    vi.mocked(createTodo)
      .mockResolvedValueOnce(todo(40, "Umzug"))
      .mockResolvedValueOnce(todo(7, "Kisten packen"));
    const retry = plan(wanted);
    await quest.create(retry);
    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createTodo).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: "Umzug", categoryId: 12 }),
    );
    expect(retry.input).toHaveBeenCalledWith({
      category,
      campaign: todo(40, "Umzug"),
    });
  });

  it("creates nothing again when only the quest failed, and forgets it once a quest exists", async () => {
    const category = { id: 12, name: "Haushalt" };
    vi.mocked(createCategory).mockResolvedValue(category);
    vi.mocked(createTodo).mockRejectedValueOnce(new Error("Offline"));
    const quest = useQuestFromText();
    await expect(quest.create(plan({ category: "Haushalt" }))).rejects.toThrow(
      "Offline",
    );
    expect(changed).toHaveBeenCalledTimes(1);

    vi.mocked(createTodo).mockResolvedValue(todo(7, "Kisten packen"));
    await quest.create(plan({ category: "Haushalt" }));
    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: 12 }),
    );
    // Nothing new was created on the retry: no second announcement.
    expect(changed).toHaveBeenCalledTimes(1);

    // A later quest naming the same new name creates it afresh.
    await quest.create(plan({ category: "Haushalt" }));
    expect(createCategory).toHaveBeenCalledTimes(2);
  });

  it("creates a different new name afresh on a retry", async () => {
    vi.mocked(createCategory)
      .mockResolvedValueOnce({ id: 12, name: "Haushalt" })
      .mockResolvedValueOnce({ id: 13, name: "Garten" });
    vi.mocked(createTodo).mockRejectedValueOnce(new Error("Offline"));
    const quest = useQuestFromText();
    await expect(quest.create(plan({ category: "Haushalt" }))).rejects.toThrow();
    vi.mocked(createTodo).mockResolvedValue(todo(7, "Kisten packen"));
    await quest.create(plan({ category: "Garten" }));
    expect(createCategory).toHaveBeenLastCalledWith("Garten");
    expect(createTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: 13 }),
    );
  });
});
