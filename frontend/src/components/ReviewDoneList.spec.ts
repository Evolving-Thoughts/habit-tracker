import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { weekReview } from "../test/week-review-fixtures";
import type { WeekReviewItem } from "../types/week-review";
import ReviewDoneList from "./ReviewDoneList.vue";

const item = (
  id: number,
  overrides: Partial<WeekReviewItem> = {},
): WeekReviewItem => ({
  type: "todo",
  id,
  title: `Quest ${id}`,
  status: "completed",
  resolvedAt: "2026-11-17T10:00:00.000Z",
  deleted: false,
  campaign: null,
  ...overrides,
});

describe("ReviewDoneList", () => {
  it("groups what was resolved by day and names campaign, daily and skips", () => {
    const days = weekReview().days.map((day) =>
      day.date === "2026-11-17"
        ? {
            ...day,
            items: [
              item(1, {
                campaign: { id: 5, title: "Buch", color: "berry", icon: null },
              }),
              item(2, { type: "habit", title: "Laufen", status: "skipped" }),
              item(3, { deleted: true }),
            ],
          }
        : day.date === "2026-11-20"
          ? { ...day, items: [item(4)] }
          : day,
    );
    const wrapper = mount(ReviewDoneList, { props: { days } });
    // Three done; the skipped run is listed and named apart, not counted.
    expect(wrapper.get("h2").text()).toBe("Erledigt 3 · 1 übersprungen");
    // The stacked list of a narrow screen shows the days with entries.
    const headings = wrapper
      .findAll(".done-list__day:not(.done-list__day--empty) h3")
      .map((heading) => heading.text());
    expect(headings).toEqual(["Dienstag, 17. Nov. 2", "Freitag, 20. Nov. 1"]);
    const rows = wrapper.findAll(".done-list__item");
    expect(rows[0]!.text()).toBe("Quest 1Kampagne Buch");
    expect(rows[0]!.get(".campaign-chip").attributes("style")).toContain(
      "var(--color-mark-berry)",
    );
    expect(rows[1]!.classes()).toContain("done-list__item--skipped");
    expect(rows[1]!.text()).toBe("LaufenDailyÜbersprungen");
    expect(rows[2]!.text()).toBe("Quest 3Gelöscht");
  });

  it("keeps all seven days in their place, empty ones quiet, today marked", () => {
    const days = weekReview().days.map((day) =>
      day.date === "2026-11-17" ? { ...day, items: [item(1)] } : day,
    );
    const wrapper = mount(ReviewDoneList, {
      props: { days, today: "2026-11-18" },
    });
    const columns = wrapper.findAll(".done-list__day");
    expect(columns.map((column) => column.attributes("data-date"))).toEqual(
      days.map((day) => day.date),
    );
    expect(columns[0]!.classes()).toContain("done-list__day--empty");
    expect(columns[0]!.get(".done-list__empty").text()).toBe("–Nichts erledigt");
    expect(columns[1]!.classes()).not.toContain("done-list__day--empty");
    // Today says so instead of its weekday, for screen readers too.
    expect(columns[2]!.attributes("aria-current")).toBe("date");
    expect(columns[2]!.classes()).toContain("done-list__day--today");
    expect(columns[2]!.get("h3").text()).toBe("Heute, 18. Nov.");
    expect(
      columns.filter((column) => column.attributes("aria-current")),
    ).toHaveLength(1);
  });

  it("says so calmly when nothing was done", () => {
    const wrapper = mount(ReviewDoneList, { props: { days: weekReview().days } });
    expect(wrapper.get("h2").text()).toBe("Erledigt 0");
    expect(wrapper.text()).toContain("In dieser Woche ist nichts erledigt.");
    expect(wrapper.find("h3").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  describe("collapsing", () => {
    const daysWith = (count: number) =>
      weekReview().days.map((day, index) =>
        index === 1
          ? {
              ...day,
              items: Array.from({ length: count }, (_, at) => item(at + 1)),
            }
          : day,
      );
    const wide = (matches: boolean) =>
      vi.stubGlobal("matchMedia", () => ({ matches }));
    /* v-show hides with an inline style. */
    const shown = (wrapper: ReturnType<typeof mount>) =>
      !(wrapper.get(".done-list__days").attributes("style") ?? "").includes(
        "display: none",
      );
    afterEach(() => vi.unstubAllGlobals());

    it("starts closed on a phone with its count and opens on request", async () => {
      wide(false);
      const wrapper = mount(ReviewDoneList, { props: { days: daysWith(3) } });
      const toggle = wrapper.get("button");
      expect(wrapper.get("h2").text()).toBe("Erledigt 3");
      expect(toggle.text()).toBe("Liste zeigen");
      expect(toggle.attributes("aria-expanded")).toBe("false");
      expect(toggle.attributes("aria-controls")).toBe(
        wrapper.get(".done-list__days").attributes("id"),
      );
      expect(shown(wrapper)).toBe(false);

      await toggle.trigger("click");
      expect(shown(wrapper)).toBe(true);
      expect(toggle.text()).toBe("Liste ausblenden");
      expect(toggle.attributes("aria-expanded")).toBe("true");
    });

    it("names a single entry as one", () => {
      wide(false);
      const wrapper = mount(ReviewDoneList, { props: { days: daysWith(1) } });
      expect(wrapper.get("button").text()).toBe("Liste zeigen");
    });

    it("is simply open on a wide screen while it is short", () => {
      wide(true);
      const wrapper = mount(ReviewDoneList, { props: { days: daysWith(8) } });
      expect(shown(wrapper)).toBe(true);
      expect(wrapper.find("button").exists()).toBe(false);
    });

    it("starts closed on a wide screen once it is long", () => {
      wide(true);
      const wrapper = mount(ReviewDoneList, { props: { days: daysWith(9) } });
      expect(shown(wrapper)).toBe(false);
      expect(wrapper.get("button").text()).toBe("Liste zeigen");
    });
  });
});
