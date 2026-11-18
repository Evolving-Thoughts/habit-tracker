import { config } from "@vue/test-utils";

// Menus teleport to the end of the page; in tests they stay in place, so a
// wrapper finds them like any other part of the component.
config.global.stubs = { ...config.global.stubs, teleport: true };

// Browser mocks are not needed by Node-environment IndexedDB tests.
if (typeof HTMLDialogElement !== "undefined") {
  // jsdom has no native top layer. Browser QA verifies real modal/focus behavior.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
}

// jsdom cannot scroll a real viewport; browser checks cover actual scroll behavior.
if (typeof window !== "undefined") window.scrollTo = () => {};
