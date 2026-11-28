import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import RowDialogs from "../components/RowDialogs.vue";
import { notifyDataChanged } from "./data-sync";
import { useRowDialogs, type RowDialog } from "./useRowDialogs";
import { useViewSession } from "./useViewSession";

enableAutoUnmount(afterEach);

/* Each dialog as a stub that reports busy, saves and closes like the real one. */
const stub = (name: string, saved: string) =>
  defineComponent({
    name,
    props: ["returnFocus", "item", "target", "today", "offerToday", "kind"],
    emits: ["busy", "close", saved],
    setup:
      (_props, { attrs }) =>
      () =>
        h("section", { role: "dialog", "data-dialog": name, ...attrs }),
  });
const STUBS = {
  EditItemDialog: stub("EditItemDialog", "changed"),
  MoveItemDialog: stub("MoveItemDialog", "moved"),
  CampaignMoveDialog: stub("CampaignMoveDialog", "moved"),
  DeleteItemDialog: stub("DeleteItemDialog", "deleted"),
};

/** A view of two rows with one resource, its session and its row dialogs. */
function view({ blocked = false } = {}) {
  const load = vi.fn(() => Promise.resolve("rows"));
  const saved = vi.fn<(dialog: RowDialog) => void>();
  const opened = vi.fn();
  let rows!: ReturnType<typeof useRowDialogs>;
  let session!: ReturnType<typeof useViewSession>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const page = ref<HTMLElement | null>(null);
        session = useViewSession({ holding: () => rows.holding() });
        session.resource(load, { initial: "", fallbackError: "kaputt" });
        rows = useRowDialogs({
          root: page,
          session,
          today: () => "2026-11-28",
          blocked: () => blocked,
          opened,
          saved,
        });
        return () =>
          h("main", { ref: page }, [
            ...["todo-1", "todo-2"].map((key) =>
              h("article", { "data-focus-key": key }, [
                h("button", { "data-edit-button": "" }, key),
              ]),
            ),
            h(RowDialogs, { dialogs: rows }),
          ]);
      },
    }),
    { attachTo: document.body, global: { stubs: STUBS } },
  );
  return {
    wrapper,
    load,
    saved,
    opened,
    rows: () => rows,
    session: () => session,
  };
}
const QUEST = { kind: "todo", id: 1, title: "Steuer" } as const;

describe("useRowDialogs", () => {
  it("opens one dialog for a row and closes it", async () => {
    const { wrapper, rows, opened } = view();
    await flushPromises();
    rows().edit("todo-1", { kind: "todo", id: 1 });
    await flushPromises();
    expect(opened).toHaveBeenCalledOnce();
    expect(
      wrapper.findAll("[role=dialog]").map((d) => d.attributes("data-dialog")),
    ).toEqual(["EditItemDialog"]);
    // A second row's dialog waits until the first one is gone.
    rows().remove("todo-2", QUEST);
    await flushPromises();
    expect(wrapper.get("[role=dialog]").attributes("data-dialog")).toBe(
      "EditItemDialog",
    );

    wrapper.getComponent({ name: "EditItemDialog" }).vm.$emit("close");
    await flushPromises();
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
    expect(rows().holding()).toBe(false);
  });

  it("hands each dialog what it acts on", async () => {
    const { wrapper, rows } = view();
    await flushPromises();
    const target = {
      type: "todo",
      todoId: 1,
      title: "Steuer",
      timeOfDay: null,
    } as const;
    rows().pickDay("todo-1", target, { offerToday: true });
    await flushPromises();
    const move = wrapper.getComponent({ name: "MoveItemDialog" });
    expect(move.props()).toMatchObject({
      item: target,
      today: "2026-11-28",
      offerToday: true,
    });
    move.vm.$emit("close");
    rows().reparent("todo-1", { todoId: 1, title: "Steuer" });
    await flushPromises();
    expect(
      wrapper.getComponent({ name: "CampaignMoveDialog" }).attributes(),
    ).toMatchObject({ "todo-id": "1", title: "Steuer" });
  });

  it("holds the session while open; a change heard meanwhile loads after closing", async () => {
    const { wrapper, rows, load } = view();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    rows().edit("todo-1", { kind: "todo", id: 1 });
    await flushPromises();
    notifyDataChanged();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);

    wrapper.getComponent({ name: "EditItemDialog" }).vm.$emit("close");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("opens nothing while a dialog saves, the session writes or the view is blocked", async () => {
    const { wrapper, rows, session } = view();
    await flushPromises();
    rows().remove("todo-1", QUEST);
    await flushPromises();
    const dialog = wrapper.getComponent({ name: "DeleteItemDialog" });
    dialog.vm.$emit("busy", true);
    expect(rows().busy.value).toBe(true);
    expect(rows().holding()).toBe(true);

    let finish!: () => void;
    const writing = session().write(
      () => new Promise<void>((r) => (finish = r)),
      { fallbackError: "x" },
    );
    wrapper.getComponent({ name: "DeleteItemDialog" }).vm.$emit("close");
    await flushPromises();
    expect(rows().busy.value).toBe(false);
    rows().edit("todo-1", { kind: "todo", id: 1 });
    await flushPromises();
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
    finish();
    await writing;

    const blocked = view({ blocked: true });
    await flushPromises();
    blocked.rows().edit("todo-1", { kind: "todo", id: 1 });
    await flushPromises();
    expect(blocked.wrapper.find("[role=dialog]").exists()).toBe(false);
  });

  it("returns the focus to the row the dialog came from", async () => {
    const { wrapper, rows } = view();
    await flushPromises();
    rows().edit("todo-2", { kind: "todo", id: 2 });
    await flushPromises();
    const returnFocus = wrapper
      .getComponent({ name: "EditItemDialog" })
      .props("returnFocus") as () => HTMLElement | null;
    expect(returnFocus()).toBe(
      wrapper.get('[data-focus-key="todo-2"] button').element,
    );
  });

  it("after a save loads the change, then lets the view announce it and closes", async () => {
    const { wrapper, rows, load, saved } = view();
    await flushPromises();
    rows().remove("todo-1", QUEST);
    await flushPromises();
    let loadedWhenSaid = 0;
    saved.mockImplementation(() => (loadedWhenSaid = load.mock.calls.length));
    wrapper.getComponent({ name: "DeleteItemDialog" }).vm.$emit("deleted");
    await flushPromises();
    expect(saved).toHaveBeenCalledWith({ kind: "delete", target: QUEST });
    // Loaded once by the save itself, before the line was said.
    expect(loadedWhenSaid).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
  });
});
