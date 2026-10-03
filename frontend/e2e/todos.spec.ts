import { test, expect } from "./fixtures";
import { createTodo, today, visit, list } from "./helpers";

test("Todo-Dump: create, persist, rename, complete/reopen and confirmed delete", async ({
  page,
  request,
}) => {
  await visit(page, "Todo-Dump");
  await createTodo(page, "NestJS lernen");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Todo-Dump", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "NestJS lernen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "NestJS lernen bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[name="editTitle"]')).toBeFocused();
  await dialog.locator('[name="editTitle"]').fill("TypeScript lernen");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "TypeScript lernen bearbeiten",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "TypeScript lernen erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "TypeScript lernen wieder öffnen",
      exact: true,
    }),
  ).toBeVisible();
  expect((await list(request, "todos"))[0]).toMatchObject({
    title: "TypeScript lernen",
    completed: true,
    plannedDurationMinutes: 30,
  });
  await page
    .getByRole("button", {
      name: "TypeScript lernen wieder öffnen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "TypeScript lernen bearbeiten", exact: true })
    .click();
  await dialog.locator('[data-test="dump-request-delete"]').click();
  await dialog.locator('[data-test="dump-cancel-delete"]').click();
  await expect(
    dialog.locator('[data-test="dump-request-delete"]'),
  ).toBeVisible();
  expect(await list(request, "todos")).toHaveLength(1);
  await dialog.locator('[data-test="dump-request-delete"]').click();
  await dialog.locator('[data-test="dump-confirm-delete"]').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".create-button")).toBeFocused();
  expect(await list(request, "todos")).toEqual([]);
});

test("Today: create scheduled Todo, edit, complete/reopen and delete", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await visit(page, "Heute");
  await createTodo(page, "Heute schreiben", `${date}T10:00`);
  await expect(
    page.getByRole("heading", { name: "Heute schreiben", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Heute schreiben bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="duration"]').fill("45");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await list(request, "todos"))[0]).toMatchObject({
    plannedDurationMinutes: 45,
  });
  await page
    .getByRole("button", { name: "Heute schreiben erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Heute schreiben wieder öffnen",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Heute schreiben wieder öffnen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Heute schreiben bearbeiten", exact: true })
    .click();
  await dialog.locator('[data-test="request-delete"]').click();
  await dialog.locator('[data-test="confirm-delete"]').click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Heute schreiben", exact: true }),
  ).toHaveCount(0);
  expect(await list(request, "todos")).toEqual([]);
});

test("scheduling a Dump Todo moves it into Today", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await visit(page, "Todo-Dump");
  await createTodo(page, "Geplantes Todo");
  await page
    .getByRole("button", { name: "Geplantes Todo bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="editScheduledAt"]').fill(`${date}T10:00`);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Geplantes Todo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Geplantes Todo", exact: true }),
  ).toBeVisible();
});

test("invalid Todo creation stays open without writing; Escape returns to plus", async ({
  page,
  request,
}) => {
  await visit(page, "Todo-Dump");
  await page.locator(".create-button").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Todo erstellen", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(await list(request, "todos")).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".create-button")).toBeFocused();
});
