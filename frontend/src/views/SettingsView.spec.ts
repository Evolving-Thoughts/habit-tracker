import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import SettingsView from "./SettingsView.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/* The sections themselves are tested on their own; here only the page around them. */
const stubs = Object.fromEntries(
  [
    "QuestTargetSetting",
    "CategorySettings",
    "ThemeSetting",
    "DayBestSetting",
    "FocusBlockSettings",
    "FocusSoundSettings",
    "SoundEffectSettings",
    "VoiceInputSettings",
    "PushSettings",
    "CalendarConnection",
    "ShortcutSettings",
  ].map((name) => [name, true]),
);

async function mountSettings() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/einstellungen", component: { template: "<div />" } }],
  });
  await router.push("/einstellungen");
  const wrapper = mount(SettingsView, {
    props: { email: "jonas@example.test" },
    attachTo: document.body,
    global: { plugins: [router], stubs },
  });
  await flushPromises();
  return wrapper;
}

describe("SettingsView jump list", () => {
  it("names every section in the page's order and links each to its address", async () => {
    const wrapper = await mountSettings();
    const nav = wrapper.get('nav[aria-label="Abschnitte der Einstellungen"]');
    const links = nav.findAll("a");
    // No keyboard is likely in the test window, so no Tastatur section.
    expect(links.map((link) => link.text())).toEqual([
      "Wochenziel",
      "Kategorien",
      "Darstellung",
      "Das Beste",
      "Fokus-Sperre",
      "Fokus-Klänge",
      "Töne",
      "Spracheingabe",
      "Benachrichtigungen",
      "Google Kalender",
      "Konto",
    ]);
    expect(links[1]!.attributes("href")).toBe(
      "#/einstellungen?abschnitt=kategorien",
    );
    // Every chip has its section, in the same order as the cards.
    const ids = wrapper
      .findAll(".settings-view__sections > section")
      .map((section) => section.attributes("id"));
    expect(ids).toEqual(
      links.map(
        (link) =>
          `abschnitt-${new URLSearchParams(link.attributes("href")!.split("?")[1]).get("abschnitt")}`,
      ),
    );
  });

  it("scrolls to the section and puts the focus on its title", async () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    const wrapper = await mountSettings();
    await wrapper
      .findAll(".settings-view__chip")
      .find((link) => link.text() === "Töne")!
      .trigger("click");
    expect(scrolled.map((element) => element.id)).toEqual(["abschnitt-toene"]);
    expect(document.activeElement?.textContent).toBe("Töne");
    expect(document.activeElement?.tagName).toBe("H2");
  });

  it("has a Spracheingabe section with its own address", async () => {
    const wrapper = await mountSettings();
    const section = wrapper.get("#abschnitt-spracheingabe");
    expect(section.get("h2").text()).toBe("Spracheingabe");
    expect(section.findComponent({ name: "VoiceInputSettings" }).exists()).toBe(
      true,
    );
  });
});
