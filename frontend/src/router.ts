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
import HabitsView from "./views/HabitsView.vue";
import QuestlogView from "./views/QuestlogView.vue";
import SettingsView from "./views/SettingsView.vue";
import TodayView from "./views/TodayView.vue";

export type ViewName =
  | "today"
  | "questlog"
  | "campaigns"
  | "calendar"
  | "dailies"
  | "categories"
  | "settings";

export type AppView = {
  name: ViewName;
  path: string;
  label: string;
  component: Component;
  /** Primary views are tabs on a phone; the rest sit behind Mehr. */
  primary: boolean;
};

/** Every view of the app, in navigation order. */
export const VIEWS: readonly AppView[] = [
  {
    name: "today",
    path: "/heute",
    label: "Heute",
    component: TodayView,
    primary: true,
  },
  {
    name: "questlog",
    path: "/questlog",
    label: "Questlog",
    component: QuestlogView,
    primary: true,
  },
  {
    name: "campaigns",
    path: "/kampagnen",
    label: "Kampagnen",
    component: CampaignsView,
    primary: true,
  },
  {
    name: "calendar",
    path: "/kalender",
    label: "Kalender",
    component: CalendarView,
    primary: true,
  },
  {
    name: "dailies",
    path: "/dailies",
    label: "Dailies",
    component: HabitsView,
    primary: false,
  },
  {
    name: "categories",
    path: "/kategorien",
    label: "Kategorien",
    component: CategoriesView,
    primary: false,
  },
  {
    name: "settings",
    path: "/einstellungen",
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
      ...VIEWS.map(({ name, path, label, component }) => ({
        name,
        path,
        component,
        meta: { title: label },
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
