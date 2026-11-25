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

test("Fokus-Sperre: in the browser Einstellungen stay editable, only the device setup is the phone's", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await openView(page, "Einstellungen");
  const section = page.getByRole("region", { name: "Fokus-Sperre" });
  await expect(section).toBeVisible();
  // On by default, blocking whenever a stopwatch runs.
  await expect(
    section.getByRole("switch", { name: "Bei der Arbeit sperren" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    section.getByRole("radio", { name: /Solange die Stoppuhr läuft/ }),
  ).toBeChecked();
  // Settings and lists live on the server: a website goes on the list here.
  const list = section.getByRole("region", { name: "Sperrliste" });
  await list.getByRole("textbox", { name: "Website" }).fill("youtube.com");
  await list.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(list.getByText("youtube.com", { exact: true })).toBeVisible();
  expect((await focusState(request)).lists.block).toEqual([
    expect.objectContaining({ kind: "domain", value: "youtube.com" }),
  ]);
  // The device setup is the Android app's (unit-tested with a fake bridge
  // in FocusBlockSettings.spec.ts); here one sentence says so.
  await expect(
    section.getByText(/Gesperrt wird auf dem Android-Handy/),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "App hinzufügen" }),
  ).toHaveCount(0);
});

test("Fokus-Sperre: a stopwatch started on Heute blocks without a Soll; Soft pauses with it", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await plan(request, { title: "Mails", scheduledDate: date });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Stoppuhr für Mails starten", exact: true })
    .click();
  await expect
    .poll(async () => (await focusState(request)).block?.mode)
    .toBe("soft");
  await page
    .getByRole("button", { name: "Stoppuhr pausieren", exact: true })
    .first()
    .click();
  await expect.poll(async () => (await focusState(request)).block).toBeNull();
  await page
    .getByRole("button", { name: "Stoppuhr fortsetzen", exact: true })
    .first()
    .click();
  await expect
    .poll(async () => (await focusState(request)).block?.mode)
    .toBe("soft");
});

test("Fokus-Sperre: a quest's own choice in its editor, and the block in the Fokus-Modus", async ({
  page,
  request,
}) => {
  const date = await today(request);
  expect(
    (
      await request.put(`${API_URL}/focus-block/settings`, {
        data: { enabled: true, trigger: "threshold", thresholdMinutes: 15 },
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

  // With nothing on the Sperrliste (and in a browser, which cannot block)
  // the Fokus-Modus offers no Soft or Hardcore, only one quiet line below
  // its buttons; the choice itself is unit-tested in FocusView.spec.ts.
  await page.getByRole("link", { name: "Fokus-Modus", exact: true }).click();
  await expect(page).toHaveURL(/#\/fokus$/);
  const quiet = page.locator("[data-test='focus-block-quiet']");
  // A string match ignores the template's line breaks around the text.
  await expect(quiet).toHaveText("Fokus-Sperre: Sperrliste leer · Einrichten");
  await expect(quiet.getByRole("link", { name: "Einrichten" })).toHaveAttribute(
    "href",
    "#/einstellungen?abschnitt=fokus-sperre",
  );
  await expect(
    page.getByRole("group", { name: "Art der Fokus-Sperre" }),
  ).toHaveCount(0);
  // The rule still starts a block with the stopwatch, Soft by default.
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

  // A block that would block nothing is not offered by hand either.
  await expect(quiet).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sperre starten", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Kapitel schreiben erledigen" }).click();
  await expect.poll(async () => (await focusState(request)).block).toBeNull();
});
