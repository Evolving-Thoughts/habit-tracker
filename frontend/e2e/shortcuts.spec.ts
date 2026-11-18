import type { APIRequestContext, Page } from "@playwright/test";
import { daysAfter, openView, today } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";

test.skip(
  ({ isMobile }) => isMobile,
  "Tastenkürzel brauchen eine Tastatur; das Handy-Projekt hat keine und zeigt auch keine Hinweise darauf.",
);

const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};
const todo = async (request: APIRequestContext, id: number) =>
  (await (await request.get(`${API_URL}/todos/${id}`)).json()) as {
    completed: boolean;
    scheduledDate: string | null;
  };

/** Heute has loaded once its quick add is there. */
async function openToday(page: Page) {
  await page.goto("/");
  await expect(
    page.locator('.today-view input[name="quickTitle"]'),
  ).toBeVisible();
}

test("Tastenkürzel: view letters open the views, ? the overview, and a field keeps its letters", async ({
  page,
}) => {
  await openToday(page);
  const heading = page.getByRole("heading", { level: 1 });
  for (const [key, address, title] of [
    ["q", /#\/questlog$/, "Questlog"],
    ["c", /#\/kampagnen$/, "Kampagnen"],
    ["k", /#\/kalender$/, null],
    ["r", /#\/rueckblick/, "Wochenrückblick"],
    ["p", /#\/plan/, null],
    ["h", /#\/heute$/, null],
  ] as const) {
    await page.keyboard.press(key);
    await expect(page).toHaveURL(address);
    if (title) await expect(heading).toHaveText(title);
  }

  // Typed into a field, the same letters are text.
  const field = page.locator('.today-view input[name="quickTitle"]');
  await field.click();
  await page.keyboard.type("Quark kaufen");
  await expect(field).toHaveValue("Quark kaufen");
  await expect(page).toHaveURL(/#\/heute$/);

  await page.locator("main").focus();
  await page.keyboard.press("?");
  const overview = page.getByRole("dialog", { name: "Tastenkürzel" });
  await expect(overview).toBeVisible();
  await expect(overview.getByText("Auf morgen verschieben")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overview).toHaveCount(0);
});

test("Tastenkürzel: N writes a new quest into the quick add, also from a view without one", async ({
  page,
}) => {
  await openToday(page);
  await page.keyboard.press("n");
  const field = page.locator('.today-view input[name="quickTitle"]');
  await expect(field).toBeFocused();
  await page.keyboard.type("Per Taste angelegt");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Per Taste angelegt" }),
  ).toBeVisible();

  await openView(page, "Dailies");
  await expect(page).toHaveURL(/#\/dailies$/);
  await page.keyboard.press("n");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(field).toBeFocused();
});

test("Tastenkürzel: X ticks the hovered quest with undo, D moves it to tomorrow, Space starts its stopwatch", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await plan(request, { title: "Kopf der Reihe", scheduledDate: date });
  const tick = await plan(request, { title: "Abhaken", scheduledDate: date });
  const move = await plan(request, {
    title: "Verschieben",
    scheduledDate: date,
  });
  const time = await plan(request, { title: "Stoppen", scheduledDate: date });
  await openToday(page);

  await page.locator(`[data-focus-key="todo-${tick.id}"]`).hover();
  await page.keyboard.press("x");
  const toast = page
    .getByRole("status")
    .filter({ hasText: "„Abhaken“ erledigt" });
  await expect(toast).toBeVisible();
  await expect
    .poll(async () => (await todo(request, tick.id)).completed)
    .toBe(true);
  await toast.getByRole("button", { name: "Rückgängig" }).click();
  await expect
    .poll(async () => (await todo(request, tick.id)).completed)
    .toBe(false);

  await page.locator(`[data-focus-key="todo-${move.id}"]`).hover();
  await page.keyboard.press("d");
  await expect(page.locator(`[data-focus-key="todo-${move.id}"]`)).toHaveCount(
    0,
  );
  await expect(
    page.getByText("„Verschieben“ steht jetzt bei morgen."),
  ).toBeAttached();
  expect((await todo(request, move.id)).scheduledDate).toBe(daysAfter(date, 1));

  await page.locator(`[data-focus-key="todo-${time.id}"]`).hover();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("complementary", { name: "Aktueller Timer" }),
  ).toContainText("Stoppen");
});

test("Tastenkürzel: F opens the Fokus-Modus and Ctrl+Enter ticks its quest", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const first = await plan(request, { title: "Im Fokus", scheduledDate: date });
  await plan(request, { title: "Danach", scheduledDate: date });
  await openToday(page);

  await page.keyboard.press("f");
  await expect(page).toHaveURL(/#\/fokus$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Im Fokus");
  await page.keyboard.press("Control+Enter");
  await expect(heading).toHaveText("Danach");
  expect((await todo(request, first.id)).completed).toBe(true);
});

test("Befehle: Ctrl+K filters, says when nothing matches, and runs a command", async ({
  page,
}) => {
  await openToday(page);
  await page.keyboard.press("Control+k");
  const menu = page.getByRole("dialog", { name: "Befehle" });
  const search = menu.getByRole("combobox", {
    name: "Ansicht oder Aktion suchen",
  });
  await expect(search).toBeFocused();
  await expect(menu.getByRole("option", { name: /^Heute/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await search.fill("zzz");
  await expect(menu.locator(".command-menu__empty")).toHaveText(
    "Nichts gefunden für „zzz“.",
  );
  await expect(menu.getByRole("status")).toHaveText(
    "Nichts gefunden für „zzz“.",
  );

  await search.fill("ruckbl");
  await expect(menu.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/#\/rueckblick/);

  // Without a keyboard: the button in the bar opens the same menu.
  await page
    .getByRole("navigation", { name: "Ansichten" })
    .getByRole("button", { name: /Befehle/ })
    .click();
  await expect(menu).toBeVisible();
  await search.fill("neue quest");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(
    page.locator('.today-view input[name="quickTitle"]'),
  ).toBeFocused();
});

test("Tastenkürzel: the switch in Einstellungen turns single keys off, and that survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await openView(page, "Einstellungen");
  const toggle = page.getByRole("switch", { name: "Tastenkürzel" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.locator("main").focus();
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/#\/einstellungen$/);

  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.locator("main").focus();
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/#\/einstellungen$/);
  // Ctrl+K stays on.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Befehle" })).toBeVisible();
  await page.keyboard.press("Escape");

  await toggle.click();
  await page.locator("main").focus();
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/#\/heute$/);
});
