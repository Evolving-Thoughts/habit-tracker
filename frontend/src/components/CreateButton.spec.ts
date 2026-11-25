import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import CreateButton from "./CreateButton.vue";
import css from "../style.css?raw";
import buttonSource from "./CreateButton.vue?raw";
import todaySource from "../views/TodayView.vue?raw";
import { ruleBody } from "../utils/contrast";
const voice = ref(true);
vi.mock("../composables/useDictation", () => ({
  useDictationAvailable: () => voice,
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  voice.value = true;
});
describe("CreateButton", () => {
  it("uses a symmetric vector plus and an accessible button label", () => {
    const wrapper = mount(CreateButton, {
      props: { label: "Daily erstellen" },
    });
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Daily erstellen",
    );
    expect(wrapper.get("svg").attributes("viewBox")).toBe("0 0 24 24");
    expect(wrapper.get("svg").attributes("aria-hidden")).toBe("true");
    expect(wrapper.get("path").attributes("d")).toBe("M12 5v14M5 12h14");
  });
  it("emits a click and respects the disabled state", async () => {
    const wrapper = mount(CreateButton, { props: { label: "Erstellen" } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    await wrapper.setProps({ disabled: true });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
  it("steps aside while the page scrolls down and returns on the way up", async () => {
    let y = 400;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
    const wrapper = mount(CreateButton, { props: { label: "Erstellen" } });
    const button = wrapper.get("button");
    expect(button.attributes("data-hidden")).toBeUndefined();
    y = 600;
    window.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(button.attributes("data-hidden")).toBeDefined();
    y = 500;
    window.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(button.attributes("data-hidden")).toBeUndefined();
    // Keyboard focus shows it even while it stepped aside.
    expect(buttonSource).toContain(
      ".create-button[data-hidden]:not(:focus-visible)",
    );
  });
  it("leaves room below the last row: the button's own size and offset, and air", () => {
    // A row scrolled to the end stays clear of the button, ▶ and … included.
    expect(css).toContain(
      "--fab-clearance: calc(var(--fab-size) + var(--fab-offset) + var(--space-5));",
    );
    expect(buttonSource).toContain("width: var(--fab-size);");
    // On a phone it floats above the tab bar and a docked stopwatch bar.
    expect(buttonSource).toContain(
      "var(--tab-bar-height) + var(--timer-bar-height, 0px) + var(--fab-offset)",
    );
    expect(ruleBody(css, ".page")).toContain(
      "padding: var(--space-5) 0 var(--fab-clearance);",
    );
    const todayStyle = todaySource.split("<style scoped>")[1]!;
    expect(ruleBody(todayStyle, ".today-view")).toContain(
      "padding: var(--space-5) 0 var(--fab-clearance);",
    );
  });

  describe("long press", () => {
    function press() {
      vi.useFakeTimers();
      const vibrate = vi.fn();
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: vibrate,
      });
      const wrapper = mount(CreateButton, { props: { label: "Erstellen" } });
      const button = wrapper.get("button");
      const down = () =>
        button.trigger("pointerdown", { button: 0, clientX: 100, clientY: 100 });
      return { wrapper, button, vibrate, down };
    }

    it("asks for dictation after half a second, with a buzz, and swallows the click", async () => {
      const { wrapper, button, vibrate, down } = press();
      expect(button.attributes("aria-description")).toBe(
        "Lange drücken zum Diktieren",
      );
      await down();
      vi.advanceTimersByTime(499);
      expect(wrapper.emitted("dictate")).toBeUndefined();
      vi.advanceTimersByTime(1);
      expect(wrapper.emitted("dictate")).toHaveLength(1);
      expect(vibrate).toHaveBeenCalledWith(10);
      await button.trigger("pointerup");
      await button.trigger("click", { detail: 1 });
      expect(wrapper.emitted("click")).toBeUndefined();
      // The next tap is a tap again.
      await down();
      await button.trigger("pointerup");
      await button.trigger("click", { detail: 1 });
      expect(wrapper.emitted("click")).toHaveLength(1);
    });

    it("stays a tap when let go earlier or moved more than 10px", async () => {
      const { wrapper, button, down } = press();
      await down();
      vi.advanceTimersByTime(300);
      await button.trigger("pointerup");
      await button.trigger("click", { detail: 1 });
      vi.advanceTimersByTime(500);
      expect(wrapper.emitted("click")).toHaveLength(1);

      await down();
      await button.trigger("pointermove", { clientX: 108, clientY: 104 });
      vi.advanceTimersByTime(200);
      await button.trigger("pointermove", { clientX: 112, clientY: 100 });
      vi.advanceTimersByTime(600);
      expect(wrapper.emitted("dictate")).toBeUndefined();
    });

    it("keeps Enter a tap, even right after a long press", async () => {
      const { wrapper, button, down } = press();
      await down();
      vi.advanceTimersByTime(500);
      // A keyboard click has no pointer details.
      await button.trigger("click", { detail: 0 });
      expect(wrapper.emitted("click")).toHaveLength(1);
    });

    it("has no long press without a microphone or while disabled", async () => {
      voice.value = false;
      const { wrapper, button, down } = press();
      expect(button.attributes("aria-description")).toBeUndefined();
      await down();
      vi.advanceTimersByTime(800);
      expect(wrapper.emitted("dictate")).toBeUndefined();

      voice.value = true;
      await wrapper.setProps({ disabled: true });
      await down();
      vi.advanceTimersByTime(800);
      expect(wrapper.emitted("dictate")).toBeUndefined();
    });
  });
});
