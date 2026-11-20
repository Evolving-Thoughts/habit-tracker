import { describe, expect, it } from "vitest";
import { hierarchyTodo } from "../test/hierarchy";
import { categoryOfChoice, parentChoices } from "./parent-choice";

const TODOS = [
  hierarchyTodo({ id: 1, title: "Buch", categoryId: 7 }),
  hierarchyTodo({ id: 2, title: "Kapitel 1", parentId: 1 }),
  hierarchyTodo({ id: 3, title: "Szene", parentId: 2, categoryId: 8 }),
  hierarchyTodo({ id: 4, title: "Kapitel 2", parentId: 1, completed: true }),
  hierarchyTodo({ id: 5, title: "Marathon", color: "pine" }),
  hierarchyTodo({ id: 6, title: "Zahnarzt" }),
];
const paths = (choices: ReturnType<typeof parentChoices>) =>
  choices.map((choice) => choice.path.join(" › "));

describe("parentChoices", () => {
  it("lists campaigns and every open quest below them, in tree order", () => {
    expect(paths(parentChoices(TODOS))).toEqual([
      "Buch",
      "Buch › Kapitel 1",
      "Buch › Kapitel 1 › Szene",
      "Marathon",
    ]);
  });

  it("leaves out the quest itself and everything below it", () => {
    expect(paths(parentChoices(TODOS, { exclude: 2 }))).toEqual([
      "Buch",
      "Marathon",
    ]);
  });

  it("keeps the current choice even when it is done or no campaign", () => {
    expect(paths(parentChoices(TODOS, { keep: 4 }))).toContain(
      "Buch › Kapitel 2",
    );
    expect(paths(parentChoices(TODOS, { keep: 6, campaignsOnly: true }))).toEqual(
      ["Buch", "Marathon", "Zahnarzt"],
    );
  });

  it("lists just the campaigns for a daily", () => {
    expect(paths(parentChoices(TODOS, { campaignsOnly: true }))).toEqual([
      "Buch",
      "Marathon",
    ]);
  });
});

describe("categoryOfChoice", () => {
  it("takes the place's own category, else its campaign's", () => {
    const choices = parentChoices(TODOS);
    const byId = (id: number) =>
      choices.find((choice) => choice.todo.id === id)!;
    expect(categoryOfChoice(byId(3))).toBe(8);
    expect(categoryOfChoice(byId(2))).toBe(7);
    expect(categoryOfChoice(byId(5))).toBeNull();
  });
});
