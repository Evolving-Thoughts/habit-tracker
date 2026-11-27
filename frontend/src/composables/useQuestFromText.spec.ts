import { TODO_FIELDS } from "../types/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory } from "../api/categories.api";
import { createTodo } from "../api/day-planner.api";
import { NewPlaceError } from "../api/new-places.api";
import type { TodoResponse } from "../types/todo";
import { colorOfName } from "../utils/category-mark";
import type { QuestParse } from "../utils/quest-parse";
import {
  newPlaces,
  questDay,
  textCategory,
  useQuestFromText,
  type QuestFromText,
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

  it("gives none for a campaign without a category, or nothing when asked to keep", () => {
    expect(textCategory(parse({ campaignId: 2 }), campaignCategory)).toBeNull();
    expect(
      textCategory(parse({ campaignId: 2 }), campaignCategory, {
        campaignWithoutCategory: "keep",
      }),
    ).toBeUndefined();
    expect(
      textCategory(parse({ campaignId: 1 }), campaignCategory, {
        campaignWithoutCategory: "keep",
      }),
    ).toBe(11);
  });

  it("gives nothing when the text names neither", () => {
    expect(textCategory(parse(), campaignCategory)).toBeUndefined();
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
