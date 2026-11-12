import { openView } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { APIRequestContext, Page } from "@playwright/test";
const create = async (
  request: APIRequestContext,
  title: string,
  parentId: number | null = null,
  duration: number | null = 30,
) => {
  const res = await request.post(`${API_URL}/todos`, {
    data: { title, parentId, plannedDurationMinutes: duration },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number };
};
const open = async (page: Page) => {
  await page.goto("/");
  await openView(page, "Aufgabenbaum");
  await expect(
    page.getByRole("heading", { name: "Aufgabenbaum", exact: true }),
  ).toBeVisible();
};
const row = (page: Page, id: number) => page.locator(`[data-todo-id="${id}"]`);
// Row actions live behind one "Aktionen für <Titel>" menu.
const menuAction = async (
  page: Page,
  id: number,
  title: string,
  name: string,
) => {
  await row(page, id)
    .getByRole("button", { name: `Aktionen für ${title}`, exact: true })
    .click();
  await row(page, id).getByRole("menuitem", { name, exact: true }).click();
};

test("Tree: add child, collapse, independent completion and reopen, persist", async ({
  page,
  request,
}) => {
  const root = await create(request, "Lernprojekt abschließen");
  await open(page);
  await menuAction(
    page,
    root.id,
    "Lernprojekt abschließen",
    "Teilaufgabe zu Lernprojekt abschließen hinzufügen",
  );
  const dialog = page.getByRole("dialog");
  await dialog.locator("[name=title]").fill("Oberfläche entwickeln");
  await dialog.locator("[name=duration]").fill("90");
  await dialog
    .getByRole("button", { name: "Todo erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oberfläche entwickeln", exact: true }),
  ).toBeVisible();
  await row(page, root.id).getByRole("checkbox").check();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  const child = (
    (await (await request.get(`${API_URL}/todos`)).json()) as {
      id: number;
      parentId: number | null;
    }[]
  ).find((t) => t.parentId === root.id)!;
  await row(page, child.id).getByRole("checkbox").check();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  await row(page, child.id).getByRole("checkbox").uncheck();
  // Reopening a child leaves the parent's own completion (and history) intact.
  await expect(row(page, child.id).getByRole("checkbox")).not.toBeChecked();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  await row(page, root.id)
    .getByRole("button", {
      name: "Lernprojekt abschließen einklappen",
      exact: true,
    })
    .click();
  await expect(row(page, child.id)).toHaveCount(0);
  await row(page, root.id)
    .getByRole("button", {
      name: "Lernprojekt abschließen ausklappen",
      exact: true,
    })
    .click();
  await expect(row(page, child.id)).toBeVisible();
  await page.reload();
  await openView(page, "Aufgabenbaum");
  await expect(row(page, child.id)).toBeVisible();
});
test("Tree: accessible move to parent and root, edit duration, preserve own schedule", async ({
  page,
  isMobile,
  request,
}) => {
  const a = await create(request, "Backend verstehen"),
    b = await create(request, "Frontend verstehen");
  await open(page);
  await menuAction(
    page,
    b.id,
    "Frontend verstehen",
    "Frontend verstehen verschieben",
  );
  const dialog = page.getByRole("dialog");
  // Touch screens keep the picker closed until it is tapped.
  await expect(isMobile ? dialog : dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("combobox").selectOption(String(a.id));
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toHaveAttribute("data-depth", "1");
  await row(page, b.id)
    .getByRole("button", { name: "Frontend verstehen bearbeiten", exact: true })
    .click();
  await dialog.locator("[name=title]").fill("Vue verstehen");
  await dialog.locator("[name=duration]").fill("45");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toContainText("45 Min.");
  await menuAction(page, b.id, "Vue verstehen", "Vue verstehen verschieben");
  await dialog.getByRole("combobox").selectOption("");
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toHaveAttribute("data-depth", "0");
});
test("Tree: review paused timer, cancel deletion, reject stale preview then confirm subtree", async ({
  page,
  request,
}) => {
  const root = await create(request, "Lernprojekt"),
    child = await create(request, "Komponenten ausprobieren", root.id);
  const started = await request.post(`${API_URL}/timers`, {
    data: { kind: "todo", targetId: child.id },
  });
  expect(started.status()).toBe(201);
  const timer = ((await started.json()) as { timer: { id: string } }).timer;
  await request.post(`${API_URL}/timers/${timer.id}/pause`, { data: {} });
  await open(page);
  await menuAction(
    page,
    root.id,
    "Lernprojekt",
    "Lernprojekt mit allen Teilaufgaben löschen",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Komponenten ausprobieren");
  await expect(dialog).toContainText("pausiert");
  await dialog
    .getByRole("button", { name: "Nicht löschen", exact: true })
    .click();
  await expect(row(page, child.id)).toBeVisible();
  await menuAction(
    page,
    root.id,
    "Lernprojekt",
    "Lernprojekt mit allen Teilaufgaben löschen",
  );
  await expect(dialog).toBeVisible();
  await create(request, "Neu hinzugefügt", root.id);
  await dialog
    .getByRole("button", { name: "Ja, löschen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("preview");
  await page
    .getByRole("button", { name: "Erneut versuchen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Neu hinzugefügt", exact: true }),
  ).toBeVisible();
  await menuAction(
    page,
    root.id,
    "Lernprojekt",
    "Lernprojekt mit allen Teilaufgaben löschen",
  );
  await expect(dialog).toContainText("Neu hinzugefügt");
  await dialog
    .getByRole("button", { name: "Ja, löschen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Noch keine Ziele.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neue Aufgabe", exact: true }),
  ).toBeFocused();
});
test("Tree: drag subtree between parents; invalid cycle is rejected", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Touch uses the tested move dialog",
  );
  const a = await create(request, "A"),
    b = await create(request, "B"),
    child = await create(request, "Kind", a.id);
  await open(page);
  await row(page, a.id).dragTo(row(page, b.id));
  await expect(row(page, a.id)).toHaveAttribute("data-depth", "1");
  await expect(row(page, child.id)).toHaveAttribute("data-depth", "2");
  await row(page, b.id).dragTo(row(page, child.id));
  await expect(page.getByRole("alert")).toContainText("descendant");
});
