import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import { openView, today } from "./helpers";
import type { FocusBlockState } from "../src/types/focus-block";

const focusState = async (request: APIRequestContext) =>
  (await (await request.get(`${API_URL}/focus-block`)).json()) as FocusBlockState;
const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};

test("Fokus-Sperre: settings and both lists in Einstellungen, honest about where blocking happens", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await openView(page, "Einstellungen");
  const section = page.getByRole("region", { name: "Fokus-Sperre" });
  await expect(section).toBeVisible();
  // In the browser: blocking happens in the Android app.
  await expect(
    section.getByText("Gesperrt wird zurzeit in der Android-App."),
  ).toBeVisible();
  await expect(section.getByText(/kein Schloss/)).toBeVisible();

  const trigger = section.getByRole("switch", { name: "Beim Fokus sperren" });
  await expect(trigger).toHaveAttribute("aria-checked", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-checked", "true");
  const minutes = section.getByLabel("ab einem Soll von (Minuten)");
  await minutes.fill("20");
  await minutes.press("Tab");
  await expect(section.getByRole("status").last()).toHaveText("Gespeichert.");
  await section.getByRole("radio", { name: "Hardcore" }).check();
  await expect(section.getByText(/Pausieren hebt sie nicht auf/)).toBeVisible();
  await expect
    .poll(async () => (await focusState(request)).settings)
    .toEqual({
      enabled: true,
      thresholdMinutes: 20,
      mode: "hardcore",
      listMode: "blocklist",
    });

  // A website as typed becomes its host; it covers every subdomain.
  const blockList = section.getByRole("region", { name: "Sperrliste" });
  await blockList.getByLabel("Website").fill("https://www.YouTube.com/watch");
  await blockList.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(blockList.getByText("youtube.com", { exact: true })).toBeVisible();
  await expect(blockList.getByText("Website mit allen Subdomains")).toBeVisible();
  await expect(blockList.getByLabel("Website")).toHaveValue("");
  // Apps come from the phone.
  await expect(
    blockList.getByText(/Apps fügst du in der Android-App hinzu/),
  ).toBeVisible();

  const allowList = section.getByRole("region", { name: "Erlaubt-Liste" });
  await expect(allowList.getByText("Telefon und Notruf")).toBeVisible();
  await expect(allowList.getByText("Habit Tracker (diese App)")).toBeVisible();
  await allowList.getByLabel("Website").fill("wikipedia.org");
  await allowList.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(
    allowList.getByText("wikipedia.org", { exact: true }),
  ).toBeVisible();
  await section
    .getByRole("radio", { name: /Alles außer der Erlaubt-Liste/ })
    .check();
  await expect
    .poll(async () => (await focusState(request)).settings.listMode)
    .toBe("allowlist");

  // A typo is refused with the server's words.
  await blockList.getByLabel("Website").fill("youtube");
  await blockList.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(section.getByRole("alert")).toContainText("keine Website");

  await allowList
    .getByRole("button", { name: "wikipedia.org von der Erlaubt-Liste nehmen" })
    .click();
  await expect(allowList.getByText("wikipedia.org", { exact: true })).toHaveCount(
    0,
  );
  const lists = (await focusState(request)).lists;
  expect(lists.block.map((entry) => entry.value)).toEqual(["youtube.com"]);
  expect(lists.allow).toEqual([]);
});

test("Fokus-Sperre: a quest's own choice in its editor, and the block in the Fokus-Modus", async ({
  page,
  request,
}) => {
  const date = await today(request);
  expect(
    (
      await request.put(`${API_URL}/focus-block/settings`, {
        data: { enabled: true, thresholdMinutes: 15 },
      })
    ).status(),
  ).toBe(200);
  const quest = await plan(request, {
    title: "Kapitel schreiben",
    scheduledDate: date,
    plannedDurationMinutes: 10,
  });

  // Below the threshold, the editor's "Immer" makes it block anyway.
  await page.goto("/");
  await page
    .getByRole("button", { name: "Kapitel schreiben bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Fokus-Sperre/ }).click();
  await expect(dialog.getByText(/sperren ab einem Soll von 15 Min/)).toBeVisible();
  await dialog.getByRole("radio", { name: "Immer" }).check();
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const todos = (await (await request.get(`${API_URL}/todos`)).json()) as {
    id: number;
    focusBlock: string;
  }[];
  expect(todos.find((todo) => todo.id === quest.id)?.focusBlock).toBe(
    "always",
  );

  // The Fokus-Modus offers Soft or Hardcore before the start.
  await page.getByRole("link", { name: "Fokus-Modus", exact: true }).click();
  await expect(page).toHaveURL(/#\/fokus$/);
  const choice = page.getByRole("group", { name: "Art der Fokus-Sperre" });
  await expect(choice.getByRole("button", { name: "Soft" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Starten", exact: true }).click();
  const line = page.locator("[data-test='focus-block-state'] [role='status']");
  await expect(line).toHaveText("Sperre aktiv · Soft");
  await expect(
    page.getByText("Gesperrt wird auf dem Handy in der Android-App."),
  ).toBeVisible();
  expect((await focusState(request)).block).toMatchObject({
    todoId: quest.id,
    mode: "soft",
  });

  // Leaving asks first; keeping the block stays in the Fokus-Modus.
  await page.getByRole("link", { name: "Heute", exact: true }).click();
  const ask = page.getByRole("dialog", { name: "Sperre aufheben?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Weiter sperren" }).click();
  await expect(page).toHaveURL(/#\/fokus$/);
  await expect(line).toHaveText("Sperre aktiv · Soft");

  // Lifting it ends the block; the stopwatch runs on.
  await page.getByRole("button", { name: "Sperre aufheben", exact: true }).click();
  await ask.getByRole("button", { name: "Sperre aufheben" }).click();
  await expect(line).toHaveCount(0);
  expect((await focusState(request)).block).toBeNull();

  // Hardcore: started by hand for the running stopwatch, no way to lift it.
  await choice.getByRole("button", { name: "Hardcore" }).click();
  await page.getByRole("button", { name: "Sperre starten", exact: true }).click();
  await expect(line).toHaveText(/^Sperre aktiv · Hardcore · noch (10|9) Min\.$/);
  await expect(
    page.getByRole("button", { name: "Sperre aufheben", exact: true }),
  ).toHaveCount(0);
  expect(
    (await request.post(`${API_URL}/focus-block/end`, { data: {} })).status(),
  ).toBe(409);
  // Done ends Hardcore too.
  await page.getByRole("button", { name: "Kapitel schreiben erledigen" }).click();
  await expect.poll(async () => (await focusState(request)).block).toBeNull();
});
