import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API_URL } from "./environment";
import { daysAfter, openView, plusButton, today } from "./helpers";

/*
 * Spracheingabe (docs/voice-input.md). Playwright has no microphone, so each
 * test sets the one test hook: with `window.__dictationStub` set before the
 * app loads, every dictation "hears" its text (dictation/stub-engine.ts).
 */
async function hear(page: Page, text: string) {
  await page.addInitScript((heard) => {
    (window as { __dictationStub?: { text: string } }).__dictationStub = {
      text: heard,
    };
  }, text);
}

type Quest = {
  title: string;
  scheduledDate: string | null;
  plannedDurationMinutes: number | null;
  parentId: number | null;
  categoryId: number | null;
};
async function quests(request: APIRequestContext): Promise<Quest[]> {
  return (await (await request.get(`${API_URL}/todos`)).json()) as Quest[];
}

const quickAdd = (page: Page) => page.locator(".quick-add").first();

test("quick add in Heute: a dictated quest with day and duration lands on that day", async ({
  page,
  request,
}) => {
  await hear(page, "Steuererklärung morgen 30 Minuten");
  const tomorrow = daysAfter(await today(request), 1);
  await page.goto("/");
  const row = quickAdd(page);
  await row.getByRole("button", { name: "Quest diktieren" }).click();
  const field = row.locator('input[name="quickTitle"]');
  await expect(field).toHaveValue("Steuererklärung morgen 30 Minuten");
  await expect(
    row.getByRole("button", { name: "Tag: morgen, entfernen" }),
  ).toHaveText("morgen");
  await expect(
    row.getByRole("button", { name: "Dauer: 30 Min., entfernen" }),
  ).toHaveText("30 Min.");

  await field.press("Enter");
  await expect(row.locator(".quick-add__notice")).toHaveText(
    "Für morgen eingeplant.",
  );
  await expect(field).toHaveValue("");
  await expect
    .poll(async () => quests(request))
    .toContainEqual(
      expect.objectContaining({
        title: "Steuererklärung",
        scheduledDate: tomorrow,
        plannedDurationMinutes: 30,
      }),
    );
  // Not today's: the row it was typed in does not show it.
  await expect(
    page.locator(".today-view").getByText("Steuererklärung", { exact: true }),
  ).toHaveCount(0);
});

test("quick add in Heute: a typed day plans the quest for that day", async ({
  page,
  request,
}) => {
  const tomorrow = daysAfter(await today(request), 1);
  await page.goto("/");
  const row = quickAdd(page);
  const field = row.locator('input[name="quickTitle"]');
  await field.fill("Wäsche morgen");
  await expect(row.locator(".parse-chip")).toHaveText(["morgen"]);
  await field.press("Enter");
  await expect
    .poll(async () => quests(request))
    .toContainEqual(
      expect.objectContaining({ title: "Wäsche", scheduledDate: tomorrow }),
    );
});

test("quick add in Heute: a dictated campaign and category put the quest below the campaign", async ({
  page,
  request,
}) => {
  const category = await request.post(`${API_URL}/categories`, {
    data: { name: "Schreiben", color: null },
  });
  expect(category.ok()).toBeTruthy();
  const { id: categoryId } = (await category.json()) as { id: number };
  // Its colour and symbol make the top-level quest a campaign.
  const campaign = await request.post(`${API_URL}/todos`, {
    data: {
      title: "Buch schreiben",
      parentId: null,
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      color: "pine",
      icon: "book",
    },
  });
  expect(campaign.ok()).toBeTruthy();
  const { id: campaignId } = (await campaign.json()) as { id: number };
  await hear(
    page,
    "Kapitel 4 gliedern morgen Kampagne Buch schreiben Kategorie Schreiben",
  );
  const tomorrow = daysAfter(await today(request), 1);
  await page.goto("/");
  const row = quickAdd(page);
  await row.getByRole("button", { name: "Quest diktieren" }).click();
  await expect(
    row.getByRole("button", { name: "Kampagne: Buch schreiben, entfernen" }),
  ).toHaveText("Kampagne: Buch schreiben");
  await expect(
    row.getByRole("button", { name: "Kategorie: Schreiben, entfernen" }),
  ).toHaveText("Kategorie: Schreiben");
  await expect(
    row.getByRole("button", { name: "Tag: morgen, entfernen" }),
  ).toBeVisible();

  await row.locator('input[name="quickTitle"]').press("Enter");
  await expect
    .poll(async () => quests(request))
    .toContainEqual(
      expect.objectContaining({
        title: "Kapitel 4 gliedern",
        scheduledDate: tomorrow,
        parentId: campaignId,
        categoryId,
      }),
    );
});

test("quick add in Heute: a dictated category that does not exist yet is created with the quest", async ({
  page,
  request,
}) => {
  await hear(page, "Wäsche waschen Kategorie Haushalt morgen");
  const tomorrow = daysAfter(await today(request), 1);
  await page.goto("/");
  const row = quickAdd(page);
  await row.getByRole("button", { name: "Quest diktieren" }).click();
  await expect(
    row.getByRole("button", {
      name: "Neue Kategorie: Haushalt, wird beim Anlegen erstellt, entfernen",
    }),
  ).toHaveText("Neue Kategorie: Haushalt");

  await row.locator('input[name="quickTitle"]').press("Enter");
  let categoryId: number | undefined;
  await expect
    .poll(async () => {
      const categories = (await (
        await request.get(`${API_URL}/categories`)
      ).json()) as { id: number; name: string }[];
      categoryId = categories.find((entry) => entry.name === "Haushalt")?.id;
      return categoryId;
    })
    .toBeDefined();
  await expect
    .poll(async () => quests(request))
    .toContainEqual(
      expect.objectContaining({
        title: "Wäsche waschen",
        scheduledDate: tomorrow,
        parentId: null,
        categoryId,
      }),
    );
});

test("a long press on Plus opens Neue Quest with the title being dictated", async ({
  page,
  request,
}) => {
  await hear(page, "Zahnarzt anrufen morgen");
  const tomorrow = daysAfter(await today(request), 1);
  await page.goto("/");
  const plus = await plusButton(page);
  await expect(plus).toHaveAttribute(
    "aria-description",
    "Lange drücken zum Diktieren",
  );
  const box = (await plus.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const dialog = page.getByRole("dialog", { name: "Neue Quest" });
  await expect(dialog).toBeVisible();
  await page.mouse.up();
  await expect(dialog.locator('input[name="title"]')).toHaveValue(
    "Zahnarzt anrufen morgen",
  );
  await expect(dialog.locator('input[name="scheduledDate"]')).toHaveValue(
    tomorrow,
  );
  await dialog.getByRole("button", { name: "Quest erstellen" }).click();
  await expect
    .poll(async () => quests(request))
    .toContainEqual(
      expect.objectContaining({
        title: "Zahnarzt anrufen",
        scheduledDate: tomorrow,
      }),
    );
});

test("no microphone anywhere once Spracheingabe is switched off", async ({
  page,
}) => {
  await hear(page, "egal");
  await page.goto("/");
  await expect(
    quickAdd(page).getByRole("button", { name: "Quest diktieren" }),
  ).toBeVisible();

  await openView(page, "Einstellungen");
  const voice = page.locator("#abschnitt-spracheingabe");
  const toggle = voice.getByRole("switch", { name: "Spracheingabe" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await openView(page, "Heute");
  await expect(quickAdd(page).locator('input[name="quickTitle"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /diktieren/ })).toHaveCount(0);
  await expect(await plusButton(page)).not.toHaveAttribute("aria-description");
});
