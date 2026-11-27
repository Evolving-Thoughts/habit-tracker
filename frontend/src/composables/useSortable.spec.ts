import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import {
  HELD_CLASS,
  LIFT_VIBRATION_MS,
  pressesControl,
  useSortable,
} from "./useSortable";
import { onCardClick } from "../utils/card-click";

type Handlers = {
  onStart: (event: { item: HTMLElement }) => void;
  onChoose: (event: { item: HTMLElement; originalEvent?: Event }) => void;
  onUnchoose: (event: { item: HTMLElement }) => void;
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

  it("rises and buzzes as soon as a finger has held a card long enough", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    const wrapper = mount(List, { attachTo: document.body });
    await nextTick();
    const card = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '[data-key="A"]',
    )!;
    const handlers = sortables.at(-1)!;
    const touch = new PointerEvent("pointerdown", { pointerType: "touch" });
    handlers.onChoose({ item: card, originalEvent: touch });
    expect(card.classList.contains(HELD_CLASS)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(LIFT_VIBRATION_MS);
    handlers.onUnchoose({ item: card });
    expect(card.classList.contains(HELD_CLASS)).toBe(false);

    // A mouse press drags as soon as it moves: no sign, no buzz.
    vibrate.mockClear();
    const mouse = new PointerEvent("pointerdown", { pointerType: "mouse" });
    handlers.onChoose({ item: card, originalEvent: mouse });
    expect(card.classList.contains(HELD_CLASS)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();

    // Without the API (desktop browsers, iOS) holding works all the same.
    Reflect.deleteProperty(navigator, "vibrate");
    expect(() =>
      handlers.onChoose({ item: card, originalEvent: touch }),
    ).not.toThrow();
    wrapper.unmount();
  });
});

describe("useSortable: a long press without a drag", () => {
  /** A list that reports a held card, as the campaign board does. */
  function holdList(onHold: (item: HTMLElement) => void) {
    return defineComponent({
      setup() {
        const container = ref<HTMLElement | null>(null);
        useSortable(container, {
          item: "[data-key]",
          onMove: () => undefined,
          onHold,
        });
        return () =>
          h("div", { ref: container }, [h("p", { "data-key": "A" }, "A")]);
      },
    });
  }
  const touch = () => new PointerEvent("pointerdown", { pointerType: "touch" });

  it("reports a card a finger held and let go without moving, and opens nothing", async () => {
    const onHold = vi.fn();
    const wrapper = mount(holdList(onHold), { attachTo: document.body });
    await nextTick();
    const card = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '[data-key="A"]',
    )!;
    const handlers = sortables.at(-1)!;
    handlers.onChoose({ item: card, originalEvent: touch() });
    handlers.onUnchoose({ item: card });
    expect(onHold).toHaveBeenCalledWith(card);

    // The click the release may bring is no tap on the card.
    const open = vi.fn();
    card.addEventListener("click", (event) => onCardClick(event, open));
    card.click();
    expect(open).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("leaves a drag a drag, and a mouse press a click", async () => {
    const onHold = vi.fn();
    const wrapper = mount(holdList(onHold), { attachTo: document.body });
    await nextTick();
    const card = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '[data-key="A"]',
    )!;
    const handlers = sortables.at(-1)!;
    // Held, then moved: the card was carried.
    handlers.onChoose({ item: card, originalEvent: touch() });
    handlers.onStart({ item: card });
    handlers.onUnchoose({ item: card });
    handlers.onEnd({ item: card, from: card.parentElement, to: card.parentElement });
    // A mouse press that never moved: an ordinary click, no hold.
    handlers.onChoose({
      item: card,
      originalEvent: new PointerEvent("pointerdown", { pointerType: "mouse" }),
    });
    handlers.onUnchoose({ item: card });
    expect(onHold).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe("pressesControl", () => {
  function card(): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = `
      <h3><button data-edit-button>Steuer</button></h3>
      <button class="ring">○</button>
      <p class="meta"><span>30 Min.</span></p>`;
    return article;
  }

  it("lets a press on the title lift the card, like one on the card itself", () => {
    const article = card();
    expect(pressesControl(article.querySelector("h3 button"), article)).toBe(
      false,
    );
    expect(pressesControl(article.querySelector(".meta span"), article)).toBe(
      false,
    );
  });

  it("keeps the card's other controls to their own tap", () => {
    const article = card();
    expect(pressesControl(article.querySelector(".ring"), article)).toBe(true);
  });
});
