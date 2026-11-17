import { today } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { NotesDocument } from "../src/api/todo-notes.api";

test("Notizen: rich text in the Fokus-Modus saves itself and is there again in the dialog", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const created = await request.post(`${API_URL}/todos`, {
    data: { title: "Kapitel schreiben", scheduledDate: date },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  const stored = async () =>
    (
      (await (await request.get(`${API_URL}/todos/${id}/notes`)).json()) as {
        notes: NotesDocument | null;
      }
    ).notes;

  await page.goto("/");
  await page.getByRole("link", { name: "Fokus-Modus", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Notizen zur Quest" });
  await expect(notes).toBeVisible();

  // Markdown shortcuts work as in Quest; the toolbar does the same by click.
  await notes.click();
  await page.keyboard.type("## Gliederung");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Erst sammeln, dann schreiben.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Checkliste", exact: true }).click();
  await page.keyboard.type("Quellen prüfen");

  await expect(
    notes.getByRole("heading", { name: "Gliederung", level: 2 }),
  ).toBeVisible();
  // Typing spaces writes text; it does not start the stopwatch.
  await expect(page.getByRole("timer", { name: "Gearbeitete Zeit" })).toHaveText(
    "00:00",
  );
  await expect(page.getByText("Bereit", { exact: true })).toBeVisible();

  await expect(page.getByText("Gespeichert", { exact: true })).toBeVisible();
  expect(await stored()).toMatchObject({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Gliederung" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Erst sammeln, dann schreiben." }],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Quellen prüfen" }],
              },
            ],
          },
        ],
      },
      // The editor keeps an empty line after a list at the end.
      { type: "paragraph" },
    ],
  });

  // A reload brings the notes back; ticking a box is saved like typing.
  await page.reload();
  const box = notes.getByRole("checkbox", { name: "Erledigt: Quellen prüfen" });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(page.getByText("Gespeichert", { exact: true })).toBeVisible();
  expect(JSON.stringify(await stored())).toContain('"checked":true');

  // The same notes in the dialog of the quest.
  await page.getByRole("link", { name: "Heute", exact: true }).click();
  await page
    .getByRole("button", { name: "Kapitel schreiben bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const dialogNotes = dialog.getByRole("textbox", {
    name: "Notizen zur Quest",
  });
  await expect(dialogNotes.getByRole("heading", { level: 2 })).toHaveText(
    "Gliederung",
  );
  await expect(dialogNotes.getByRole("checkbox")).toBeChecked();

  // A link is entered in a row of its own; Enter there does not send the form.
  await dialogNotes.getByText("Erst sammeln, dann schreiben.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Siehe ");
  await dialog.getByRole("button", { name: "Link", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Linkadresse" }).fill("example.org");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(
    dialogNotes.getByRole("link", { name: "example.org" }),
  ).toHaveAttribute("href", "https://example.org");

  // Closing right away still sends what was typed last.
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => JSON.stringify(await stored()))
    .toContain('"href":"https://example.org"');
});
