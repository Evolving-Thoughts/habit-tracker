import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFocusBlockController,
  focusBlockKey,
} from "../composables/useFocusBlock";
import type { FocusBlockNative } from "../native/focus-block-plugin";
import type { FocusBlockState } from "../types/focus-block";
import FocusBlockSettings from "./FocusBlockSettings.vue";

enableAutoUnmount(afterEach);

const state = (overrides: Partial<FocusBlockState> = {}): FocusBlockState => ({
  version: "v",
  serverNow: new Date().toISOString(),
  settings: {
    enabled: true,
    trigger: "stopwatch",
    thresholdMinutes: 15,
    mode: "soft",
    listMode: "blocklist",
  },
  block: null,
  lists: {
    block: [
      { id: 1, kind: "domain", value: "youtube.com", label: null },
      {
        id: 2,
        kind: "app",
        value: "com.instagram.android",
        label: "Instagram",
      },
    ],
    allow: [],
  },
  fixedDomains: ["plan.evolving-thoughts.com"],
  ...overrides,
});

function fakeNative(): FocusBlockNative {
  return {
    getStatus: vi.fn().mockResolvedValue({
      accessibilityEnabled: true,
      vpnPrepared: false,
    }),
    openAccessibilitySettings: vi.fn().mockResolvedValue(undefined),
    requestVpnPermission: vi.fn().mockResolvedValue({ granted: true }),
    listInstalledApps: vi.fn().mockResolvedValue([
      { label: "YouTube", packageName: "com.google.android.youtube" },
      { label: "Instagram", packageName: "com.instagram.android" },
    ]),
    setBlock: vi.fn().mockResolvedValue(undefined),
    onOpenFocus: vi.fn(() => () => {}),
  };
}

async function mountSettings(
  initial = state(),
  native: FocusBlockNative | null = fakeNative(),
) {
  const focus = createFocusBlockController(native);
  focus.state.value = initial;
  const spies = {
    saveSettings: vi.spyOn(focus, "saveSettings").mockResolvedValue(true),
    addEntry: vi.spyOn(focus, "addEntry").mockResolvedValue(true),
    removeEntry: vi.spyOn(focus, "removeEntry").mockResolvedValue(true),
  };
  const wrapper = mount(FocusBlockSettings, {
    attachTo: document.body,
    global: { provide: { [focusBlockKey as symbol]: focus } },
  });
  await flushPromises();
  return { wrapper, focus, ...spies };
}

describe("FocusBlockSettings", () => {
  it("switches the trigger, its threshold, the mode and the list mode", async () => {
    const { wrapper, focus, saveSettings } = await mountSettings();
    await wrapper.get("[data-test='focus-enabled']").trigger("click");
    expect(saveSettings).toHaveBeenLastCalledWith({ enabled: false });
    // "Solange die Stoppuhr läuft" needs no threshold.
    expect(
      wrapper.get<HTMLInputElement>("[data-test='focus-trigger-stopwatch']")
        .element.checked,
    ).toBe(true);
    expect(wrapper.find("input[name='focusThreshold']").exists()).toBe(false);
    expect(wrapper.text()).toContain("Pausierst oder beendest du die Stoppuhr");
    await wrapper.get("[data-test='focus-trigger-threshold']").setValue(true);
    expect(saveSettings).toHaveBeenLastCalledWith({ trigger: "threshold" });
    const current = focus.state.value!;
    focus.state.value = {
      ...current,
      settings: { ...current.settings, trigger: "threshold" },
    };
    await flushPromises();
    await wrapper.get("input[name='focusThreshold']").setValue("25");
    expect(saveSettings).toHaveBeenLastCalledWith({ thresholdMinutes: 25 });
    await wrapper.get("input[name='focusThreshold']").setValue("0");
    expect(wrapper.text()).toContain("Gib ganze Minuten von 1 bis 600 an.");
    await wrapper.get("[data-test='focus-mode-hardcore']").setValue(true);
    expect(saveSettings).toHaveBeenLastCalledWith({ mode: "hardcore" });
    await wrapper
      .get("[data-test='focus-list-mode-allowlist']")
      .setValue(true);
    expect(saveSettings).toHaveBeenLastCalledWith({ listMode: "allowlist" });
  });

  it("lists apps and websites, adds a typed website and removes an entry", async () => {
    const { wrapper, addEntry, removeEntry } = await mountSettings();
    const block = wrapper.get("[data-test='focus-list-block']");
    expect(block.text()).toContain("youtube.com");
    expect(block.text()).toContain("Instagram");
    expect(block.text()).toContain("App · com.instagram.android");
    await block.get("input[name='focus-domain-block']").setValue("reddit.com");
    await block.get("form").trigger("submit");
    expect(addEntry).toHaveBeenCalledWith({
      list: "block",
      kind: "domain",
      value: "reddit.com",
    });
    await block
      .get("[aria-label='youtube.com von der Sperrliste nehmen']")
      .trigger("click");
    expect(removeEntry).toHaveBeenCalledWith(1);
  });

  it("shows what is always allowed and says honestly what it is", async () => {
    const { wrapper } = await mountSettings();
    const allow = wrapper.get("[data-test='focus-list-allow']");
    expect(allow.text()).toContain("Telefon und Notruf");
    expect(allow.text()).toContain("Habit Tracker (diese App)");
    expect(allow.text()).toContain("plan.evolving-thoughts.com");
    expect(wrapper.text()).toContain("kein Schloss");
  });

  it("switched off shows only the switch and its sentence, and keeps the values", async () => {
    const off = state();
    off.settings = { ...off.settings, enabled: false, thresholdMinutes: 25 };
    const { wrapper, focus } = await mountSettings(off);
    expect(wrapper.get("[data-test='focus-enabled']").attributes("aria-checked")).toBe("false");
    expect(wrapper.text()).toContain("Gilt für Quests und Dailies auf „Standard“");
    expect(wrapper.find("[data-test='focus-trigger-stopwatch']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-test='focus-mode-soft']").exists()).toBe(false);
    expect(wrapper.find("[data-test='focus-list-block']").exists()).toBe(false);
    expect(wrapper.find("[data-test='focus-device']").exists()).toBe(false);
    // Switched on again, the options come back with their values.
    focus.state.value = {
      ...off,
      settings: { ...off.settings, enabled: true, trigger: "threshold" },
    };
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>("input[name='focusThreshold']").element.value,
    ).toBe("25");
    expect(wrapper.find("[data-test='focus-list-block']").exists()).toBe(true);
  });

  it("in a browser keeps settings and lists editable, without the device setup", async () => {
    const { wrapper, saveSettings } = await mountSettings(state(), null);
    expect(wrapper.get("[data-test='focus-web']").text()).toContain(
      "Gesperrt wird auf dem Android-Handy",
    );
    await wrapper.get("[data-test='focus-mode-hardcore']").setValue(true);
    expect(saveSettings).toHaveBeenLastCalledWith({ mode: "hardcore" });
    const block = wrapper.get("[data-test='focus-list-block']");
    expect(block.text()).toContain("Instagram");
    expect(block.find("input[name='focus-domain-block']").exists()).toBe(true);
    // Apps are picked on the phone only.
    expect(block.text()).not.toContain("App hinzufügen");
    expect(wrapper.find("[data-test='focus-device']").exists()).toBe(false);
    expect(wrapper.find("[data-test='focus-setup']").exists()).toBe(false);
  });

  it("says what keeps the phone from blocking, with the button to fix it", async () => {
    const native = fakeNative();
    vi.mocked(native.getStatus).mockResolvedValue({
      accessibilityEnabled: false,
      vpnPrepared: false,
    });
    const { wrapper } = await mountSettings(state(), native);
    const hint = wrapper.get("[data-test='focus-setup']");
    expect(hint.text()).toContain("Apps sperrt sie erst");
    expect(hint.text()).toContain("Websites sperrt sie erst");
    await hint.get("[data-test='focus-setup-accessibility']").trigger("click");
    expect(native.openAccessibilitySettings).toHaveBeenCalled();
    await hint.get("[data-test='focus-setup-vpn']").trigger("click");
    expect(native.requestVpnPermission).toHaveBeenCalled();
  });

  it("separates the setup hint's sentences", async () => {
    const native = fakeNative();
    vi.mocked(native.getStatus).mockResolvedValue({
      accessibilityEnabled: false,
      vpnPrepared: true,
    });
    const { wrapper } = await mountSettings(
      state({ lists: { block: [], allow: [] } }),
      native,
    );
    const text = wrapper.get("[data-test='focus-setup']").text();
    expect(text).toContain("Die Fokus-Sperre wirkt so noch nicht. Die Sperrliste");
    // Settings links nowhere for the list: it is right here.
    expect(wrapper.get("[data-test='focus-setup']").find("a").exists()).toBe(
      false,
    );
  });

  it("suggests a site that fits each list in its field", async () => {
    const { wrapper } = await mountSettings();
    expect(
      wrapper.get("input[name='focus-domain-block']").attributes("placeholder"),
    ).toBe("youtube.com");
    expect(
      wrapper.get("input[name='focus-domain-allow']").attributes("placeholder"),
    ).toBe("wikipedia.org");
  });

  it("lets the lists only get stricter while Hardcore runs", async () => {
    const { wrapper } = await mountSettings(
      state({
        block: {
          id: "b",
          title: "Kapitel",
          todoId: 1,
          occurrenceId: null,
          mode: "hardcore",
          listMode: "blocklist",
          startedAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
    );
    expect(wrapper.text()).toContain("nur strenger machen");
    expect(
      wrapper
        .get("[aria-label='youtube.com von der Sperrliste nehmen']")
        .attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get("input[name='focus-domain-allow']").attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get("input[name='focus-domain-block']").attributes("disabled"),
    ).toBeUndefined();
  });

  it("on Android shows the setup with its stand and picks installed apps", async () => {
    const native = fakeNative();
    const { wrapper, addEntry } = await mountSettings(state(), native);
    const device = wrapper.get("[data-test='focus-device']");
    expect(device.text()).toContain("Eingeschaltet");
    expect(device.text()).toContain("Noch nicht erlaubt");
    await device
      .findAll("button")
      .find((button) => button.text() === "VPN erlauben")!
      .trigger("click");
    expect(native.requestVpnPermission).toHaveBeenCalled();
    await device
      .findAll("button")
      .find((button) => button.text() === "Bedienungshilfen öffnen")!
      .trigger("click");
    expect(native.openAccessibilitySettings).toHaveBeenCalled();

    await wrapper
      .get("[data-test='focus-list-block']")
      .findAll("button")
      .find((button) => button.text().includes("App hinzufügen"))!
      .trigger("click");
    await flushPromises();
    const picks = wrapper.findAll(".focus-settings__pick");
    expect(picks.map((pick) => pick.text())).toEqual([
      expect.stringContaining("Instagram"),
      expect.stringContaining("YouTube"),
    ]);
    // Instagram is on the list already.
    expect(picks[0]!.attributes("disabled")).toBeDefined();
    await picks[1]!.trigger("click");
    expect(addEntry).toHaveBeenCalledWith({
      list: "block",
      kind: "app",
      value: "com.google.android.youtube",
      label: "YouTube",
    });
  });
});
