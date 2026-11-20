import type { Component } from "vue";
import {
  createRouter,
  createWebHashHistory,
  type RouteLocationNormalized,
  type Router,
  type RouterHistory,
} from "vue-router";
import CalendarView from "./views/CalendarView.vue";
import CampaignsView from "./views/CampaignsView.vue";
import FocusView from "./views/FocusView.vue";
import HabitsView from "./views/HabitsView.vue";
import PlanView from "./views/PlanView.vue";
import QuestlogView from "./views/QuestlogView.vue";
import SettingsView from "./views/SettingsView.vue";
import TodayView from "./views/TodayView.vue";
import WeekReviewView from "./views/WeekReviewView.vue";
import { PATHS, SECTION_QUERY, sectionId, type ViewName } from "./routes";
import { getCurrentDateInTimeZone } from "./utils/date";
import { holdScroll } from "./utils/scroll-hold";
import { planQueryFromWeek } from "./utils/week-plan";

export type { ViewName };

export type AppView = {
  name: ViewName;
  path: string;
  label: string;
  component: Component;
  /** Primary views are tabs on a phone; the rest sit behind Mehr. */
  primary: boolean;
  /** Starts a group in the top bar, set off by a little more space. */
  groupStart?: boolean;
  /** Fills the screen alone: no navigation and no timer bar around it. */
  immersive?: boolean;
};

/**
 * Every view of the app, in navigation order, grouped by intent: the day
 * (Heute, Fokus), planning (Kalender, Plan, Questlog), the long run
 * (Kampagnen, Dailies), looking back (Wochenrückblick). Einstellungen is
 * last; the top bar shows it as a gear at the far right.
 */
export const VIEWS: readonly AppView[] = [
  {
    name: "today",
    path: PATHS.today,
    label: "Heute",
    component: TodayView,
    primary: true,
  },
  {
    name: "focus",
    path: PATHS.focus,
    label: "Fokus",
    component: FocusView,
    primary: false,
    immersive: true,
  },
  {
    name: "calendar",
    path: PATHS.calendar,
    label: "Kalender",
    component: CalendarView,
    primary: true,
    groupStart: true,
  },
  {
    name: "plan",
    path: PATHS.plan,
    label: "Plan",
    component: PlanView,
    primary: false,
  },
  {
    name: "questlog",
    path: PATHS.questlog,
    label: "Questlog",
    component: QuestlogView,
    primary: true,
  },
  {
    name: "campaigns",
    path: PATHS.campaigns,
    label: "Kampagnen",
    component: CampaignsView,
    primary: true,
    groupStart: true,
  },
  {
    name: "dailies",
    path: PATHS.dailies,
    label: "Dailies",
    component: HabitsView,
    primary: false,
  },
  {
    name: "review",
    path: PATHS.review,
    label: "Wochenrückblick",
    component: WeekReviewView,
    primary: false,
    groupStart: true,
  },
  {
    name: "settings",
    path: PATHS.settings,
    label: "Einstellungen",
    component: SettingsView,
    primary: false,
  },
];

export const APP_NAME = "Habit Tracker";

export type AuthLink = { kind: "verify" | "reset"; token: string };

declare module "vue-router" {
  interface RouteMeta {
    /** Shown in the browser title. */
    title?: string;
    /** The view fills the screen alone. */
    immersive?: boolean;
    /** Set on the routes an email link lands on. */
    authLink?: AuthLink["kind"];
  }
}

/**
 * Where `?abschnitt=` points, as a page offset; null without one. The
 * section keeps its `scroll-margin-top` free, and below a bar that sticks to
 * the top of the page (`data-sticky-top`, the timer bar) as well.
 */
function sectionTop(to: RouteLocationNormalized): number | null {
  const name = to.query[SECTION_QUERY];
  if (typeof name !== "string") return null;
  const section = document.getElementById(sectionId(name));
  if (!section) return null;
  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const sticky = document.querySelector<HTMLElement>("[data-sticky-top]");
  const covered = sticky ? sticky.getBoundingClientRect().height : 0;
  return (
    section.getBoundingClientRect().top + window.scrollY - margin - covered
  );
}

export function createAppRouter(
  history: RouterHistory = createWebHashHistory(),
): Router {
  const router = createRouter({
    history,
    routes: [
      ...VIEWS.map(({ name, path, label, component, immersive }) => ({
        name,
        path,
        component,
        meta: { title: label, immersive },
      })),
      // Kategorien became a section of Einstellungen; old links land there.
      {
        path: "/kategorien",
        redirect: {
          name: "settings",
          query: { [SECTION_QUERY]: "kategorien" },
        },
      },
      // Email links keep their token in the fragment ("#verify=<token>"), so it
      // never reaches a server log. App.vue takes it and leaves the route.
      ...(["verify", "reset"] as const).map((kind) => ({
        name: kind,
        path: `/${kind}=:token`,
        component: { render: () => null },
        meta: { authLink: kind },
      })),
      { path: "/:unknown(.*)*", redirect: { name: "today" } },
    ],
    // Back and Forward return to the saved place, anything else starts at
    // the top or at the section asked for; either is held while the view
    // loads, so growing content does not push it away.
    scrollBehavior: (to, _from, saved) => {
      const place = () => saved?.top ?? sectionTop(to) ?? 0;
      holdScroll(place);
      return saved ?? { top: place() };
    },
  });
  // The Plan used to show a week (?woche=<Monday>); it now starts at a day.
  router.beforeEach((to) => {
    if (to.name !== "plan" || to.query.woche === undefined) return;
    return {
      name: "plan",
      query: planQueryFromWeek(to.query.woche, getCurrentDateInTimeZone()),
      replace: true,
    };
  });
  router.afterEach((to) => {
    document.title = to.meta.title
      ? `${to.meta.title} · ${APP_NAME}`
      : APP_NAME;
  });
  return router;
}
