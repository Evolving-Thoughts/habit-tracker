import { afterEach, describe, expect, it } from "vitest";
import { ref } from "vue";
import { useListFocus } from "./useListFocus";
afterEach(() => {
  document.body.innerHTML = "";
});
function list() {
  const element = document.createElement("main");
  document.body.append(element);
  const render = (ids: string[]) => {
    element.innerHTML =
      ids
        .map(
          (id) =>
            `<article data-focus-key="${id}"><button data-edit-button>${id}</button></article>`,
        )
        .join("") + '<button class="create-button">+</button>';
  };
  render(["a", "b", "c"]);
  return {
    element,
    render,
    focus: useListFocus(ref<HTMLElement | null>(element)),
  };
}
describe("useListFocus", () => {
  it("finds the original item after its DOM has been replaced and reordered", () => {
    const { element, render, focus } = list();
    focus.remember("b");
    render(["c", "a", "b"]);
    expect(focus.returnFocus()).toBe(
      element.querySelector('[data-focus-key="b"] button'),
    );
  });
  it("uses the next neighbour when the original item was deleted", () => {
    const { element, render, focus } = list();
    focus.remember("b");
    render(["a", "c"]);
    expect(focus.returnFocus()).toBe(
      element.querySelector('[data-focus-key="c"] button'),
    );
  });
  it("uses the previous neighbour when the last item was deleted", () => {
    const { element, render, focus } = list();
    focus.remember("c");
    render(["a", "b"]);
    expect(focus.returnFocus()).toBe(
      element.querySelector('[data-focus-key="b"] button'),
    );
  });
  it("uses the creation button when the list is empty", () => {
    const { element, render, focus } = list();
    focus.remember("a");
    render([]);
    expect(focus.returnFocus()).toBe(element.querySelector(".create-button"));
  });
  it("handles a missing root", () => {
    const focus = useListFocus(ref(null));
    focus.remember("a");
    expect(focus.returnFocus()).toBeNull();
  });
});
