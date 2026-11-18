import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import indexHtml from "../../index.html?raw";

/** A matchMedia whose answers the test sets and changes. */
function fakeMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, ((event: { matches: boolean }) => void)[]>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return state[query] ?? false;
    },
    media: query,
    addEventListener: (
      _type: string,
      listener: (event: { matches: boolean }) => void,
    ) => listeners.set(query, [...(listeners.get(query) ?? []), listener]),
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return {
    set(query: string, matches: boolean) {
      state[query] = matches;
      for (const listener of listeners.get(query) ?? []) listener({ matches });
    },
  };
}

const DARK = "(prefers-color-scheme: dark)";
const REDUCE = "(prefers-reduced-motion: reduce)";

async function load() {
  vi.resetModules();
  return import("./useTheme");
}

const root = document.documentElement;
const meta = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute("content");

beforeEach(() => {
  localStorage.clear();
  delete root.dataset.theme;
  root.classList.remove("theme-fade");
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTheme", () => {
  it("follows the device by default, live", async () => {
    const media = fakeMedia({ [DARK]: false });
    const { startTheme, theme, themeChoice, THEME_COLORS } = await load();
    startTheme();
    expect(themeChoice.value).toBe("system");
    expect(root.dataset.theme).toBe("light");
    expect(meta()).toBe(THEME_COLORS.light);

    media.set(DARK, true);
    await nextTick();
    expect(theme.value).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(meta()).toBe(THEME_COLORS.dark);

    media.set(DARK, false);
    await nextTick();
    expect(root.dataset.theme).toBe("light");
  });

  it("keeps a stored choice over the device", async () => {
    const media = fakeMedia({ [DARK]: false });
    localStorage.setItem("theme", "dark");
    const { startTheme, themeChoice } = await load();
    startTheme();
    expect(themeChoice.value).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    media.set(DARK, false);
    await nextTick();
    expect(root.dataset.theme).toBe("dark");
  });

  it("ignores a stored value it does not know", async () => {
    fakeMedia({ [DARK]: true });
    localStorage.setItem("theme", "sepia");
    const { startTheme, themeChoice } = await load();
    startTheme();
    expect(themeChoice.value).toBe("system");
    expect(root.dataset.theme).toBe("dark");
  });

  it("stores the choice on this device; the device's own is no entry", async () => {
    fakeMedia({ [DARK]: true });
    const { startTheme, setThemeChoice } = await load();
    startTheme();
    setThemeChoice("light");
    await nextTick();
    expect(localStorage.getItem("theme")).toBe("light");
    expect(root.dataset.theme).toBe("light");
    setThemeChoice("system");
    await nextTick();
    expect(localStorage.getItem("theme")).toBeNull();
    expect(root.dataset.theme).toBe("dark");
  });

  it("follows a choice made in another tab", async () => {
    fakeMedia({ [DARK]: false });
    const { startTheme } = await load();
    startTheme();
    localStorage.setItem("theme", "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
    await nextTick();
    expect(root.dataset.theme).toBe("dark");
  });

  it("cross-fades a switch briefly, but not with reduced motion", async () => {
    vi.useFakeTimers();
    const media = fakeMedia({ [DARK]: false, [REDUCE]: false });
    const { startTheme, setThemeChoice } = await load();
    startTheme();
    // Starting never fades: the boot script already painted the theme.
    expect(root.classList.contains("theme-fade")).toBe(false);
    setThemeChoice("dark");
    await nextTick();
    expect(root.classList.contains("theme-fade")).toBe(true);
    vi.advanceTimersByTime(300);
    expect(root.classList.contains("theme-fade")).toBe(false);

    media.set(REDUCE, true);
    setThemeChoice("light");
    await nextTick();
    expect(root.dataset.theme).toBe("light");
    expect(root.classList.contains("theme-fade")).toBe(false);
  });
});

describe("the boot script in index.html", () => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? "";

  it("is a classic inline script in the head, before the app", () => {
    expect(script).toContain("data-theme");
    expect(indexHtml.indexOf(script)).toBeLessThan(
      indexHtml.indexOf("</head>"),
    );
    expect(indexHtml.indexOf(script)).toBeLessThan(
      indexHtml.indexOf('src="/src/main.ts"'),
    );
  });

  const cases: [string | null, boolean, "light" | "dark"][] = [
    [null, false, "light"],
    [null, true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["nonsense", true, "dark"],
  ];
  for (const [stored, deviceDark, expected] of cases)
    it(`sets ${expected} for choice ${stored ?? "none"} on a ${deviceDark ? "dark" : "light"} device, like the app`, async () => {
      fakeMedia({ [DARK]: deviceDark });
      if (stored) localStorage.setItem("theme", stored);
      new Function(script)();
      expect(root.dataset.theme).toBe(expected);
      const fromScript = meta();

      delete root.dataset.theme;
      const { startTheme, THEME_COLORS } = await load();
      startTheme();
      expect(root.dataset.theme).toBe(expected);
      expect(fromScript).toBe(THEME_COLORS[expected]);
    });

  it("still sets light when storage is blocked", () => {
    fakeMedia({ [DARK]: false });
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    new Function(script)();
    expect(root.dataset.theme).toBe("light");
    getItem.mockRestore();
  });
});
