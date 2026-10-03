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
export async function visit(
  page: Page,
  view: "Heute" | "Todo-Dump" | "Habits",
) {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: view, exact: true })
    .click();
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
