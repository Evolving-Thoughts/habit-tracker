import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { useSortable } from "./useSortable";

type Handlers = {
  onStart: (event: { item: HTMLElement }) => void;
  onEnd: (event: Record<string, unknown>) => void;
};
const sortables: Handlers[] = [];
vi.mock("sortablejs", () => ({
  default: {
    create: (_element: HTMLElement, options: Handlers) => {
      sortables.push(options);
      return { destroy: () => undefined };
    },
  },
}));

/** A list whose entries are fragments, as `<template v-for>` renders them. */
const List = defineComponent({
  setup() {
    const container = ref<HTMLElement | null>(null);
    const items = ref(["A", "B", "C"]);
    useSortable(container, {
      item: "[data-key]",
      onMove: (from, to) => {
        const next = [...items.value];
        const [entry] = next.splice(from, 1);
        next.splice(to, 0, entry!);
        items.value = next;
      },
    });
    return () =>
      h(
        "div",
        { ref: container },
        items.value.map((title) =>
          // A keyed fragment: Vue keeps it between two text anchors.
          h("template", { key: title }, [h("p", { "data-key": title }, title)]),
        ),
      );
  },
});

describe("useSortable", () => {
  it("moves a card of a fragment list without leaving a copy behind", async () => {
    const wrapper = mount(List, { attachTo: document.body });
    await nextTick();
    const handlers = sortables.at(-1)!;
    const list = wrapper.element as HTMLElement;
    const last = list.querySelector<HTMLElement>('[data-key="C"]')!;

    // What SortableJS does: lift the card and move its node to the top.
    handlers.onStart({ item: last });
    list.insertBefore(last, list.firstChild);
    handlers.onEnd({
      item: last,
      from: list,
      to: list,
      oldIndex: 2,
      newIndex: 0,
      oldDraggableIndex: 2,
      newDraggableIndex: 0,
    });
    await nextTick();

    expect(
      [...list.querySelectorAll("[data-key]")].map((node) => node.textContent),
    ).toEqual(["C", "A", "B"]);
    wrapper.unmount();
  });
});
