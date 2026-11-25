import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import {
  getDayBest,
  getDayBestMonths,
  getDayBests,
  saveDayBest,
} from "../api/day-bests.api";
import type { DayBest } from "../types/day-best";
import DayBestView from "./DayBestView.vue";

vi.mock("../api/day-bests.api", () => ({
  getDayBest: vi.fn(),
  getDayBestMonths: vi.fn(),
  getDayBests: vi.fn(),
  saveDayBest: vi.fn(),
}));
enableAutoUnmount(afterEach);

const LINES: DayBest[] = [
  { date: "2026-11-20", text: "Schnee im Garten" },
  { date: "2026-11-02", text: "Erster Glühwein" },
  { date: "2026-10-10", text: "Pilze gefunden" },
  { date: "2026-07-01", text: "Baden im See" },
  { date: "2025-11-23", text: "Konzert mit Anna" },
];

function serve(lines: DayBest[]): void {
  const months = new Map<string, number>();
  for (const line of lines)
    months.set(line.date.slice(0, 7), (months.get(line.date.slice(0, 7)) ?? 0) + 1);
  vi.mocked(getDayBestMonths).mockResolvedValue({
    today: "2026-11-23",
    months: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, count]) => ({ month, count })),
  });
  vi.mocked(getDayBests).mockImplementation(async (from, to) => ({
    entries: lines
      .filter((line) => line.date >= from && line.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date)),
  }));
  vi.mocked(getDayBest).mockImplementation(async (date) => ({
    date,
    text: lines.find((line) => line.date === date)?.text ?? "",
  }));
}

async function render(path = "/das-beste") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ name: "best", path: "/das-beste", component: DayBestView }],
  });
  await router.push(path);
  const wrapper = mount(
    { template: "<RouterView />" },
    { global: { plugins: [router] }, attachTo: document.body },
  );
  await flushPromises();
  return { wrapper, router };
}

describe("DayBestView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serve(LINES);
    vi.mocked(saveDayBest).mockImplementation(async (date, text) => ({
      date,
      text: text.trim(),
    }));
  });

  it("lists lines newest first in months, each with its honest count", async () => {
    const { wrapper } = await render();
    const heads = wrapper.findAll(".day-best-month__head");
    // Three months per step: November, October, July 2026.
    expect(heads.map((head) => head.text())).toEqual([
      "November 2026 2 von 23 Tagen",
      "Oktober 2026 1 von 31 Tagen",
      "Juli 2026 1 von 31 Tagen",
    ]);
    const rows = wrapper.findAll(".day-best-row__text");
    expect(rows.map((row) => row.text())).toEqual([
      "Schnee im Garten",
      "Erster Glühwein",
      "Pilze gefunden",
      "Baden im See",
    ]);
    // Days without a line are not listed; today has a field instead.
    expect(wrapper.get(".day-best-view__today textarea")).toBeTruthy();
  });

  it("loads older months on request and then says where it begins", async () => {
    const { wrapper } = await render();
    await wrapper.get(".day-best-view__more button").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".day-best-month__head").at(-1)!.text()).toContain(
      "November 2025",
    );
    expect(wrapper.find(".day-best-view__more button").exists()).toBe(false);
    expect(wrapper.get(".day-best-view__end").text()).toBe("Hier fängt es an.");
  });

  it("remembers the same day a year ago", async () => {
    const { wrapper } = await render();
    const memory = wrapper.get(".day-best-view__memory");
    expect(memory.text()).toContain("Heute vor einem Jahr");
    expect(memory.text()).toContain("Sonntag, 23. Nov. 2025");
    expect(memory.text()).toContain("Konzert mit Anna");
  });

  it("explains the idea when there is nothing yet and invites today's line", async () => {
    serve([]);
    const { wrapper } = await render();
    // One calm card: title, one sentence and the field; no month to choose.
    const card = wrapper.get(".day-best-view__today");
    expect(card.get(".card-title").text()).toBe("Das Beste von heute");
    expect(card.text()).toContain("nur für dich");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Monat wählen");
    const field = wrapper.get(".day-best-view__today textarea");
    expect(field.attributes("placeholder")).toBe("Zum Beispiel: ein Gespräch");
    // The label stays for screen readers; the card title names it.
    expect(wrapper.get(".day-best-field__label").text()).toBe(
      "Das Beste von heute",
    );
    await field.setValue("Erster Eintrag");
    await field.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(saveDayBest).toHaveBeenCalledWith("2026-11-23", "Erster Eintrag");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.get(".day-best-month__head").text()).toBe(
      "November 2026 1 von 23 Tagen",
    );
    expect(wrapper.find(".day-best-view__today").exists()).toBe(false);
  });

  it("changes a line in place, and removes it when emptied", async () => {
    const { wrapper } = await render();
    await wrapper.get("#best-2026-11-02 button").trigger("click");
    const field = wrapper.get("#best-2026-11-02 textarea");
    expect(document.activeElement).toBe(field.element);
    await field.setValue("Erster Glühwein am Markt");
    await field.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.get("#best-2026-11-02").text()).toContain(
      "Erster Glühwein am Markt",
    );
    expect(document.activeElement).toBe(
      wrapper.get("#best-2026-11-02 button").element,
    );

    await wrapper.get("#best-2026-11-02 button").trigger("click");
    await wrapper.get("#best-2026-11-02 textarea").setValue("");
    await wrapper
      .get("#best-2026-11-02 textarea")
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.find("#best-2026-11-02").exists()).toBe(false);
    expect(wrapper.get(".day-best-month__head").text()).toBe(
      "November 2026 1 von 23 Tagen",
    );
  });

  it("opens at the day the search found, with the way back to now", async () => {
    const { wrapper, router } = await render("/das-beste?tag=2026-07-01");
    expect(wrapper.findAll(".day-best-month__head")[0]!.text()).toContain(
      "Juli 2026",
    );
    expect(document.activeElement).toBe(
      wrapper.get("#best-2026-07-01 button").element,
    );
    expect(wrapper.get("#best-2026-07-01").classes()).toContain(
      "day-best-row--found",
    );
    // Away from now, no field for today and no memory; "Heute" leads back.
    expect(wrapper.find(".day-best-view__today").exists()).toBe(false);
    const back = wrapper
      .findAll(".day-best-view__nav button")
      .find((button) => button.text() === "Heute")!;
    await back.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/das-beste");
    expect(wrapper.findAll(".day-best-month__head")[0]!.text()).toContain(
      "November 2026",
    );
  });

  it("jumps to a month with lines; months without lines are not links", async () => {
    const { wrapper, router } = await render();
    const toggle = wrapper.get('button[aria-controls="day-best-jump"]');
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    const links = wrapper.findAll("#day-best-jump a");
    expect(links.map((link) => link.get(".visually-hidden").text())).toEqual([
      "Juli 2026, 1 Eintrag",
      "Oktober 2026, 1 Eintrag",
      "November 2026, 2 Einträge",
      "November 2025, 1 Eintrag",
    ]);
    await links[0]!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/das-beste?monat=2026-07");
    expect(wrapper.findAll(".day-best-month__head")[0]!.text()).toContain(
      "Juli 2026",
    );
  });
});
