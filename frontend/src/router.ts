import type { Component } from "vue";
import {
  createRouter,
  createWebHashHistory,
  type Router,
  type RouterHistory,
} from "vue-router";
import CalendarView from "./views/CalendarView.vue";
import CampaignsView from "./views/CampaignsView.vue";
import CategoriesView from "./views/CategoriesView.vue";
import FocusView from "./views/FocusView.vue";
import HabitsView from "./views/HabitsView.vue";
import PlanView from "./views/PlanView.vue";
import QuestlogView from "./views/QuestlogView.vue";
import SettingsView from "./views/SettingsView.vue";
import TodayView from "./views/TodayView.vue";
import WeekReviewView from "./views/WeekReviewView.vue";
import { PATHS, type ViewName } from "./routes";

export type { ViewName };

export type AppView = {
  name: ViewName;
  path: string;
  label: string;
  component: Component;
  /** Primary views are tabs on a phone; the rest sit behind Mehr. */
  primary: boolean;
  /** Behind Mehr on a phone, but a tab in its own place on wide screens. */
  tabWhenWide?: boolean;
  /** Fills the screen alone: no navigation and no timer bar around it. */
  immersive?: boolean;
};

/** Every view of the app, in navigation order. */
export const VIEWS: readonly AppView[] = [
  {
    name: "today",
    path: PATHS.today,
    label: "Heute",
    component: TodayView,
    primary: true,
  },
  {
    name: "plan",
    path: PATHS.plan,
    label: "Plan",
    component: PlanView,
    primary: false,
    tabWhenWide: true,
  },
  {
    name: "review",
    path: PATHS.review,
    label: "Wochenrückblick",
    component: WeekReviewView,
    primary: false,
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
  },
  {
    name: "calendar",
    path: PATHS.calendar,
    label: "Kalender",
    component: CalendarView,
    primary: true,
  },
  {
    name: "dailies",
    path: PATHS.dailies,
    label: "Dailies",
    component: HabitsView,
    primary: false,
  },
  {
    name: "categories",
    path: PATHS.categories,
    label: "Kategorien",
    component: CategoriesView,
    primary: false,
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
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  });
  router.afterEach((to) => {
    document.title = to.meta.title
      ? `${to.meta.title} · ${APP_NAME}`
      : APP_NAME;
  });
  return router;
}
