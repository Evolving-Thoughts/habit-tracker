import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL } from "./environment";
export async function today(request: APIRequestContext): Promise<string> {
  const result = await request.get(`${API_URL}/day-planner/today`);
  expect(result.ok()).toBeTruthy();
  return ((await result.json()) as { date: string }).date;
}
export function daysAfter(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
const SHORT_MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
];
const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
/** "7. Okt.", as the calendar writes dates. */
export function shortDate(date: string): string {
  return `${Number(date.slice(8, 10))}. ${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]}`;
}
/** "Mittwoch, 7. Okt." */
export function dayLabel(date: string): string {
  return `${WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}, ${shortDate(date)}`;
}
/** Opens a view; on phones the rarer views sit behind Mehr. */
export async function openView(page: Page, name: string) {
  const navigation = page.getByRole("navigation", { name: "Ansichten" });
  const target = navigation.getByRole("button", { name, exact: true });
  await expect(navigation).toBeVisible();
  if (!(await target.isVisible()))
    await navigation.getByRole("button", { name: "Mehr", exact: true }).click();
  await target.click();
}
/** Opens Kalender (Monat by default) and waits until it has loaded. */
export async function openCalendar(
  page: Page,
  mode: "Monat" | "Woche" | "Tag" = "Monat",
) {
  await openView(page, "Kalender");
  const view = page.locator(".calendar-view");
  const loading = view.getByRole("status", { name: "Kalender wird geladen" });
  await expect(view).toBeVisible();
  await expect(loading).toHaveCount(0);
  if (mode !== "Monat") {
    await view.getByRole("button", { name: mode, exact: true }).click();
    await expect(
      view.getByRole("button", { name: mode, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(loading).toHaveCount(0);
  }
  return view;
}
/** Picks Alle, Todos or Habits in the calendar filter. */
export async function filterCalendar(
  page: Page,
  label: "Alle" | "Todos" | "Habits",
) {
  const menuButton = page
    .locator(".calendar-view")
    .getByRole("button", { name: /^Einträge: / });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("menu", { name: "Einträge" })
    .getByRole("menuitemradio", { name: label, exact: true })
    .click();
  await expect(page.getByRole("menu", { name: "Einträge" })).toHaveCount(0);
  await expect(menuButton).toHaveAccessibleName(`Einträge: ${label}`);
}
/** Today folds finished items away; this unfolds them. */
export async function showResolved(page: Page) {
  const toggle = page.getByRole("button", { name: /\d+ abgeschlossen/ });
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
}
export async function visit(
  page: Page,
  view: "Heute" | "Todo-Dump" | "Habits",
) {
  await page.goto("/");
  await openView(page, view);
  await expect(page.locator(".create-button")).toBeEnabled();
}
export async function createTodo(
  page: Page,
  title: string,
  scheduledAt?: string,
) {
  await page.locator(".create-button").click();
  const dialog = page.getByRole("dialog");
  if (await dialog.locator('[data-test="choose-todo"]').count())
    await dialog.locator('[data-test="choose-todo"]').click();
  await dialog.locator('[name="title"]').fill(title);
  if (scheduledAt)
    await dialog.locator('[name="scheduledAt"]').fill(scheduledAt);
  await dialog.locator('[name="duration"]').fill("30");
  await dialog
    .getByRole("button", { name: "Todo erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
export async function createHabit(
  page: Page,
  title: string,
  type: "interval" | "fixed_weekdays" | "weekly_target" = "interval",
  startDate?: string,
) {
  await page.locator(".create-button").click();
  const dialog = page.getByRole("dialog");
  if (await dialog.locator('[data-test="choose-habit"]').count())
    await dialog.locator('[data-test="choose-habit"]').click();
  await dialog.locator('[name="title"]').fill(title);
  if (startDate) await dialog.locator('[name="startDate"]').fill(startDate);
  await dialog.locator('[name="scheduleType"]').selectOption(type);
  if (type === "interval")
    await dialog.locator('[name="intervalDays"]').fill("2");
  if (type === "fixed_weekdays") {
    await dialog.getByLabel("Montag", { exact: true }).check();
    await dialog.getByLabel("Donnerstag", { exact: true }).check();
  }
  if (type === "weekly_target")
    await dialog.locator('[name="weeklyTarget"]').fill("3");
  await dialog
    .getByRole("button", { name: "Habit erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
export async function list(
  request: APIRequestContext,
  resource: "habits" | "todos",
) {
  const response = await request.get(`${API_URL}/${resource}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
