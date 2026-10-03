import { test, expect } from "./fixtures";
import { createTodo, today, visit, list } from "./helpers";
import { API_URL } from "./environment";

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
    page.getByRole("heading", { name: "TypeScript lernen", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Heute", exact: true })
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
    scheduledAt: null,
    completedAt: expect.any(String),
    plannedDurationMinutes: 30,
  });
  await page
    .getByRole("button", {
      name: "TypeScript lernen wieder öffnen",
      exact: true,
    })
    .click();
  // click() waits for the DOM action, not for the asynchronous PATCH/reload.
  // An unscheduled reopened Todo must disappear from Today before the next step.
  await expect(
    page.getByRole("heading", { name: "TypeScript lernen", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Todo-Dump", exact: true })
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

test("switching back to Dump before reopen finishes refreshes it after the write", async ({
  page,
  request,
}) => {
  const created = await request.post(`${API_URL}/todos`, {
    data: { title: "Verzögertes Todo" },
  });
  expect(created.status()).toBe(201);
  const todo = (await created.json()) as { id: number };
  expect(
    (
      await request.patch(`${API_URL}/todos/${todo.id}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);
  await visit(page, "Heute");
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route(`**/todos/${todo.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    entered();
    await gate;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", {
        name: "Verzögertes Todo wieder öffnen",
        exact: true,
      })
      .click();
    await started;
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Todo-Dump", exact: true })
      .click();
    // Prove that the newly mounted Dump first reads the old completed state.
    await expect(
      page.getByText("Dein Todo-Dump ist leer.", { exact: true }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("button", {
        name: "Verzögertes Todo bearbeiten",
        exact: true,
      }),
    ).toBeVisible();
    expect((await list(request, "todos"))[0]).toMatchObject({
      completed: false,
      completedAt: null,
      scheduledAt: null,
    });
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
