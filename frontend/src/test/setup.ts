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

// jsdom cannot scroll a real viewport; browser checks cover actual scroll behavior.
window.scrollTo = () => {};
