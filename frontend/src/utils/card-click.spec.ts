import { describe, expect, it, vi } from "vitest";
import { noteDragEnd, onCardClick } from "./card-click";

function card(): { root: HTMLElement; text: HTMLElement; button: HTMLElement } {
  const root = document.createElement("article");
  root.innerHTML =
    '<p class="text">Lesen <span class="inner">heute</span></p><button type="button"><svg></svg></button>';
  document.body.append(root);
  return {
    root,
    text: root.querySelector(".inner")!,
    button: root.querySelector("svg") as unknown as HTMLElement,
  };
}

function click(root: HTMLElement, target: HTMLElement, open: () => void) {
  root.addEventListener("click", (event) => onCardClick(event, open), {
    once: true,
  });
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
}

describe("onCardClick", () => {
  it("opens the editor from a tap on the card's text", () => {
    const open = vi.fn();
    const { root, text } = card();
    click(root, text, open);
    expect(open).toHaveBeenCalledOnce();
  });

  it("leaves the card's own controls their tap", () => {
    const open = vi.fn();
    const { root, button } = card();
    click(root, button, open);
    expect(open).not.toHaveBeenCalled();
  });

  it("ignores the click that ends a drag", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { root, text } = card();
    noteDragEnd();
    click(root, text, open);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    click(root, text, open);
    expect(open).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("takes a new press right after a drag as a tap", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { root, text } = card();
    noteDragEnd();
    vi.advanceTimersByTime(100);
    text.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    click(root, text, open);
    expect(open).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
