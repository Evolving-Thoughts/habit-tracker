import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTodo } from "../api/day-planner.api";
import { getDeletionPreview } from "../api/todo-hierarchy.api";
import { useTodoDeletion } from "./useTodoDeletion";

vi.mock("../api/day-planner.api", () => ({ deleteTodo: vi.fn() }));
vi.mock("../api/todo-hierarchy.api", () => ({ getDeletionPreview: vi.fn() }));

const preview = {
  confirmationToken: "a".repeat(64),
  todos: [{ id: 1, title: "Root", parentId: null, completed: false }],
  timers: [],
};

describe("useTodoDeletion", () => {
  beforeEach(() => {
    vi.mocked(getDeletionPreview).mockResolvedValue(preview);
    vi.mocked(deleteTodo).mockResolvedValue(undefined);
  });

  it("deletes with the token of the shown preview and announces it", async () => {
    const changed = vi.fn();
    window.addEventListener("timer-data-changed", changed);
    const deletion = useTodoDeletion();
    await deletion.prepare(1);
    expect(deletion.preview.value).toEqual(preview);
    await deletion.confirm();
    expect(deleteTodo).toHaveBeenCalledWith(1, "a".repeat(64));
    expect(deletion.preview.value).toBeNull();
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("timer-data-changed", changed);
  });

  it("drops a rejected (stale) preview so it must be reviewed again", async () => {
    vi.mocked(deleteTodo).mockRejectedValueOnce(new Error("409"));
    const deletion = useTodoDeletion();
    await deletion.prepare(1);
    await expect(deletion.confirm()).rejects.toThrow("409");
    expect(deletion.preview.value).toBeNull();
  });

  it("refuses to delete without a preview", async () => {
    await expect(useTodoDeletion().confirm()).rejects.toThrow("Löschvorschau");
    expect(deleteTodo).not.toHaveBeenCalled();
  });
});
