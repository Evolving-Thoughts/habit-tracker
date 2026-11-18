import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { getQuestHours } from "../api/quest-hours.api";
import { getWeekReview, saveWeekReview } from "../api/week-review.api";
import {
  campaignRow,
  MONDAY,
  questHours,
  weekReview,
} from "../test/week-review-fixtures";
import WeekReviewView from "./WeekReviewView.vue";

vi.mock("../api/quest-hours.api", () => ({ getQuestHours: vi.fn() }));
vi.mock("../api/week-review.api", () => ({
  getWeekReview: vi.fn(),
  saveWeekReview: vi.fn(),
}));
vi.mock("../utils/date", async (original) => ({
  ...(await original<typeof import("../utils/date")>()),
  getCurrentDateInTimeZone: () => "2026-11-18",
}));

enableAutoUnmount(afterEach);

const LAST_MONDAY = "2026-11-09";
const NEXT_MONDAY = "2026-11-23";

/** A week with time and a done quest. */
function busyWeek(start = MONDAY) {
  const hours = questHours({
    startDate: start,
    weeklyTargetMinutes: 600,
    questMinutes: 300,
    otherMinutes: 60,
    campaigns: [
      {
        campaign: { id: 5, title: "Buch", color: "berry", icon: "book" },
        minutes: 300,
        weeklyTargetMinutes: 360,
        weeks: [0, 0, 0, 0, 0, 0, 0, 300],
        totalMinutes: 300,
      },
    ],
  });
  hours.days[1]!.questMinutes = 300;
  hours.days[1]!.otherMinutes = 60;
  hours.weeks[7]!.questMinutes = 300;
  const review = weekReview({ startDate: start, campaigns: [campaignRow()] });
  review.days[1]!.items = [
    {
      type: "todo",
      id: 9,
      title: "Kapitel 1",
      status: "completed",
      resolvedAt: "2026-11-17T10:00:00.000Z",
      deleted: false,
      campaign: { id: 5, title: "Buch", color: "berry", icon: "book" },
    },
  ];
  return { hours, review };
}

async function mountReview(path = "/rueckblick") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/rueckblick", name: "review", component: WeekReviewView },
    ],
  });
  await router.push(path);
  const wrapper = mount(WeekReviewView, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  await flushPromises();
  return { wrapper, router };
}

const sectionTitles = (wrapper: Awaited<ReturnType<typeof mountReview>>["wrapper"]) =>
  wrapper.findAll("h2").map((heading) => heading.text());

describe("WeekReviewView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const { hours, review } = busyWeek();
    vi.mocked(getQuestHours).mockResolvedValue(hours);
    vi.mocked(getWeekReview).mockResolvedValue(review);
  });

  it("loads both reads for this week and shows the sections in order", async () => {
    const { wrapper } = await mountReview();

    expect(getQuestHours).toHaveBeenCalledWith(MONDAY, expect.any(AbortSignal));
    expect(getWeekReview).toHaveBeenCalledWith(MONDAY, expect.any(AbortSignal));
    expect(wrapper.get("h1").text()).toBe("Wochenrückblick");
    expect(wrapper.get(".page-lead").text()).toBe(
      "Wie weit die Woche deine Kampagnen gebracht hat.",
    );
    // The switcher names the week between its arrows.
    expect(wrapper.get(".week-review__range").text()).toBe(
      "16.–22. Nov. diese Woche",
    );
    // The dashboard first, then what the week changed, then the questions.
    expect(sectionTitles(wrapper)).toEqual([
      "Kennzahlen",
      "Quest-Stunden je Tag",
      "Stunden je Kampagne",
      "Quest-Arbeit gegen Sonstiges",
      "Quest-Stunden · letzte Wochen",
      "Fortschritt je Kampagne",
      "Erledigt 1",
      "Rückblick",
    ]);
    // Day bars beside a column with the hours per campaign and the split.
    const charts = wrapper.get(".week-review__charts");
    expect(charts.find(".day-bars").exists()).toBe(true);
    expect(
      charts
        .get(".week-review__side")
        .findAll("h2")
        .map((heading) => heading.text()),
    ).toEqual(["Stunden je Kampagne", "Quest-Arbeit gegen Sonstiges"]);
  });

  it("shows the Dailies against what was due and the perfect week side by side", async () => {
    const { hours, review } = busyWeek();
    vi.mocked(getQuestHours).mockResolvedValue(hours);
    vi.mocked(getWeekReview).mockResolvedValue({
      ...review,
      weekQuota: { completed: 5, total: 8, percentage: 63 },
      perfectWeek: {
        perfect: false,
        categories: [
          { id: 1, name: "Sport", target: 2, completed: 1, reached: false },
        ],
      },
    });
    const { wrapper } = await mountReview();
    const pair = wrapper.get(".week-quota--dashboard");
    expect(pair.findAll("h2").map((heading) => heading.text())).toEqual([
      "Dailies im Wochensoll",
      "Perfekte Woche",
    ]);
    expect(pair.get(".quota").classes()).not.toContain("quota--lifted");
    expect(sectionTitles(wrapper).slice(-4)).toEqual([
      "Dailies im Wochensoll",
      "Perfekte Woche",
      "Erledigt 1",
      "Rückblick",
    ]);
  });

  it("shows the figures but no empty charts for a week with only resolved quests", async () => {
    const { review } = busyWeek();
    vi.mocked(getQuestHours).mockResolvedValue(questHours());
    vi.mocked(getWeekReview).mockResolvedValue(review);
    const { wrapper } = await mountReview();
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.find(".week-review__charts").exists()).toBe(false);
    expect(sectionTitles(wrapper)).toEqual([
      "Kennzahlen",
      "Fortschritt je Kampagne",
      "Erledigt 1",
      "Rückblick",
    ]);
  });

  it("keeps the week in the address and switches it", async () => {
    const { wrapper, router } = await mountReview(
      `/rueckblick?woche=${LAST_MONDAY}`,
    );
    expect(getWeekReview).toHaveBeenLastCalledWith(
      LAST_MONDAY,
      expect.any(AbortSignal),
    );
    expect(wrapper.get(".week-review__range").text()).toBe(
      "9.–15. Nov. vorige Woche",
    );

    await wrapper.get('button[aria-label="Nächste Woche"]').trigger("click");
    await flushPromises();
    // The current week keeps the plain address.
    expect(router.currentRoute.value.query).toEqual({});
    expect(getQuestHours).toHaveBeenLastCalledWith(
      MONDAY,
      expect.any(AbortSignal),
    );

    await wrapper.get('button[aria-label="Vorige Woche"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ woche: LAST_MONDAY });

    await wrapper.get("button.btn:not(.btn--icon)").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({});
  });

  it("holds the dashboard's shape with bones while loading", async () => {
    vi.mocked(getQuestHours).mockReturnValue(new Promise(() => {}));
    const { wrapper } = await mountReview();
    const loading = wrapper.get(
      '[role="status"][aria-label="Wochenrückblick wird geladen"]',
    );
    // Three figures, the day bars beside two side cards, the recent weeks.
    expect(
      loading.get(".week-review__figures-bones").findAll(".week-review__bone"),
    ).toHaveLength(3);
    const charts = loading.get(".week-review__charts");
    expect(charts.find(".week-review__bone--days").exists()).toBe(true);
    expect(
      charts.get(".week-review__side").findAll(".week-review__bone"),
    ).toHaveLength(2);
    expect(loading.find(".week-review__bone--trend").exists()).toBe(true);
    expect(wrapper.find("h2").exists()).toBe(false);
  });

  it("reads an empty week calmly instead of a wall of empty charts", async () => {
    vi.mocked(getQuestHours).mockResolvedValue(questHours());
    vi.mocked(getWeekReview).mockResolvedValue(weekReview());
    const { wrapper } = await mountReview();
    expect(wrapper.get(".empty-state").text()).toContain(
      "In dieser Woche ist nichts gemessen und nichts erledigt.",
    );
    expect(sectionTitles(wrapper)).toEqual(["Rückblick"]);
    expect(wrapper.find("form").exists()).toBe(true);
  });

  it("keeps the figures and the weeks before around an empty week that has them", async () => {
    const empty = questHours({ weeklyTargetMinutes: 600 });
    empty.weeks[5]!.questMinutes = 240;
    vi.mocked(getQuestHours).mockResolvedValue(empty);
    vi.mocked(getWeekReview).mockResolvedValue(weekReview());
    const { wrapper } = await mountReview();
    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".week-review__charts").exists()).toBe(false);
    expect(sectionTitles(wrapper)).toEqual([
      "Kennzahlen",
      "Quest-Stunden · letzte Wochen",
      "Rückblick",
    ]);
    // The calm card stands where the charts would be.
    const body = wrapper.get(".week-review__body").element.children;
    expect([...body].map((child) => child.className.split(" ")[0])).toEqual([
      "figures",
      "empty-state",
      "week-trend",
      "answers",
    ]);
  });

  it("says a week still ahead lies ahead and keeps its questions closed", async () => {
    const ahead = questHours({ startDate: NEXT_MONDAY });
    ahead.weeks[6]!.questMinutes = 300;
    vi.mocked(getQuestHours).mockResolvedValue(ahead);
    vi.mocked(getWeekReview).mockResolvedValue(
      weekReview({
        startDate: NEXT_MONDAY,
        perfectWeek: {
          perfect: false,
          categories: [
            { id: 1, name: "Sport", target: 2, completed: 0, reached: false },
          ],
        },
      }),
    );
    const { wrapper } = await mountReview(`/rueckblick?woche=${NEXT_MONDAY}`);
    expect(wrapper.get(".empty-state").text()).toContain(
      "Diese Woche liegt noch vor dir.",
    );
    expect(sectionTitles(wrapper)).toEqual(["Rückblick"]);
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("keeps the review when the quest hours fail, with the error and a retry", async () => {
    vi.mocked(getQuestHours).mockRejectedValueOnce(new Error("Kaputt"));
    const { wrapper } = await mountReview();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Kaputt");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(sectionTitles(wrapper)).toEqual([
      "Fortschritt je Kampagne",
      "Erledigt 1",
      "Rückblick",
    ]);

    await alert.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(sectionTitles(wrapper)[0]).toBe("Kennzahlen");
  });

  it("keeps the quest hours when the review fails", async () => {
    vi.mocked(getWeekReview).mockRejectedValue(new Error("Weg"));
    const { wrapper } = await mountReview();
    expect(wrapper.get('[role="alert"]').text()).toContain("Weg");
    expect(sectionTitles(wrapper)).toEqual([
      "Kennzahlen",
      "Quest-Stunden je Tag",
      "Stunden je Kampagne",
      "Quest-Arbeit gegen Sonstiges",
      "Quest-Stunden · letzte Wochen",
    ]);
  });

  it("keeps saved answers when the view is shown again", async () => {
    vi.mocked(saveWeekReview).mockResolvedValue({
      wentWell: "Viel",
      wentBadly: null,
      changeNext: null,
    });
    const { wrapper } = await mountReview();
    await wrapper.get('[name="wentWell"]').setValue("Viel");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(saveWeekReview).toHaveBeenCalledWith(MONDAY, {
      wentWell: "Viel",
      wentBadly: "",
      changeNext: "",
    });
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert");
  });
});
