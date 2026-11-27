import { TODO_FIELDS } from "../types/fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCategories } from "../api/categories.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { hierarchyTodo } from "../test/hierarchy";
import {
  forgetQuestParseContext,
  useQuestParseContext,
} from "./useQuestParseContext";

vi.mock("../api/categories.api", () => ({ getCategories: vi.fn() }));
vi.mock("../api/todo-hierarchy.api", () => ({ getTodoHierarchy: vi.fn() }));

describe("useQuestParseContext › supply", () => {
  afterEach(() => forgetQuestParseContext());

  it("takes lists loaded elsewhere without loading them, one list known at a time", () => {
    const names = useQuestParseContext();
    names.supply({ categories: [{ id: 10, name: "Sport" }] });
    expect(names.options.value.categories).toEqual([
      expect.objectContaining({ id: 10, name: "Sport" }),
    ]);
    // Campaigns not supplied are unknown: none named, none offered as new.
    expect(names.options.value.campaigns).toBeUndefined();

    names.supply({
      todos: [
        hierarchyTodo({ id: 1, title: "Buch schreiben", categoryId: 11 }),
        hierarchyTodo({ id: 2, title: "Kapitel 3", parentId: 1 }),
      ],
    });
    expect(names.options.value.campaigns).toEqual([
      { id: 1, title: "Buch schreiben", icon: null },
    ]);
    expect(names.options.value.categories).toHaveLength(1);
    expect(names.campaign(1)?.todo.title).toBe("Buch schreiben");
    expect(names.campaignCategory(1)).toBe(11);
    expect(getTodoHierarchy).not.toHaveBeenCalled();
    expect(getCategories).not.toHaveBeenCalled();
  });

  it("remembers a created category in a supplied list only", () => {
    const names = useQuestParseContext();
    names.supply({ categories: [] });
    names.remember({
      category: { id: 12, name: "Haushalt" },
      campaign: {
        ...TODO_FIELDS,
        id: 40,
        parentId: null,
        title: "Umzug",
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: true,
      },
    });
    expect(names.options.value.categories).toEqual([
      expect.objectContaining({ id: 12, name: "Haushalt" }),
    ]);
    expect(names.options.value.campaigns).toBeUndefined();
  });
});
