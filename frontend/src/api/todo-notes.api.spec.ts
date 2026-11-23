import { describe, expect, it, vi } from "vitest";
import { request } from "./http";
import { getNotes, setNotes, type NotesDocument } from "./todo-notes.api";

vi.mock("./http", () => ({ request: vi.fn() }));

describe("note writes", () => {
  it.each([true, false])("keeps edit order when the first save succeeds: %s", async (success) => {
    const target = { kind: "todo" as const, id: 3 };
    const latest: NotesDocument = { type: "doc", content: [{ type: "paragraph" }] };
    let finish!: () => void;
    const firstRequest = new Promise<{ notes: null }>((resolve, reject) => {
      finish = () => success ? resolve({ notes: null }) : reject(new Error("offline"));
    });
    vi.mocked(request).mockReset()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValue({ notes: latest });

    const first = setNotes(target, null).catch(() => undefined);
    const second = setNotes(target, latest);
    const reopened = getNotes(target);
    expect(request).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(await second).toEqual(latest);
    expect(await reopened).toEqual(latest);
    expect(vi.mocked(request).mock.calls.map(([, options]) => options?.method ?? "GET"))
      .toEqual(["PUT", "PUT", "GET"]);
  });
});
