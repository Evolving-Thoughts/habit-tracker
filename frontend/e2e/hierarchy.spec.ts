import { openView } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { APIRequestContext, Page } from "@playwright/test";
const create = async (
  request: APIRequestContext,
  title: string,
  parentId: number | null = null,
  duration: number | null = 30,
  extra: Record<string, unknown> = {},
) => {
  const res = await request.post(`${API_URL}/todos`, {
    data: { title, parentId, plannedDurationMinutes: duration, ...extra },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number };
};
/**
 * A campaign before it has quests: its colour makes it one. A plain
 * top-level quest is no campaign and does not stand in the tree.
 */
const campaign = (request: APIRequestContext, title: string) =>
  create(request, title, null, 30, { color: "berry" });
const open = async (page: Page) => {
  await page.goto("/");
  await openView(page, "Kampagnen");
  await expect(
    page.getByRole("heading", { name: "Kampagnen", exact: true }),
  ).toBeVisible();
};
const row = (page: Page, id: number) => page.locator(`[data-todo-id="${id}"]`);
// Row actions live behind one "Aktionen für <Titel>" menu, shown at the end
// of the page (so no scrolling list can cut it off).
const menuAction = async (
  page: Page,
  id: number,
  title: string,
  name: string,
) => {
  await row(page, id)
    .getByRole("button", { name: `Aktionen für ${title}`, exact: true })
    .click();
  await page
    .getByRole("menu", { name: title, exact: true })
    .getByRole("menuitem", { name, exact: true })
    .click();
};

test("Tree: add child, collapse, independent completion and reopen, persist", async ({
  page,
  request,
}) => {
  const root = await campaign(request, "Lernprojekt abschließen");
  await open(page);
  await menuAction(
    page,
    root.id,
    "Lernprojekt abschließen",
    "Unter-Quest zu Lernprojekt abschließen hinzufügen",
  );
  const dialog = page.getByRole("dialog");
  await dialog.locator("[name=title]").fill("Oberfläche entwickeln");
  await dialog.locator("[name=duration]").fill("90");
  await dialog
    .getByRole("button", { name: "Quest erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oberfläche entwickeln", exact: true }),
  ).toBeVisible();
  const child = (
    (await (await request.get(`${API_URL}/todos`)).json()) as {
      id: number;
      parentId: number | null;
    }[]
  ).find((t) => t.parentId === root.id)!;
  // Progress counts the quest below, not the campaign's own 30 minutes.
  await expect(row(page, root.id).locator(".row__count")).toHaveText(
    "0/90 Min.",
  );
  // The campaign still has an open quest: it asks first, the quest stays open.
  await row(page, root.id).getByRole("checkbox").click();
  const question = page.getByRole("dialog", { name: "Kampagne abschließen?" });
  await expect(question).toContainText(
    "1 Quest in „Lernprojekt abschließen“ ist noch offen. Sie bleibt offen",
  );
  await question
    .getByRole("button", { name: "Abbrechen", exact: true })
    .click();
  await expect(question).toHaveCount(0);
  await expect(row(page, root.id).getByRole("checkbox")).not.toBeChecked();
  await row(page, root.id).getByRole("checkbox").click();
  await question
    .getByRole("button", { name: "Kampagne abschließen", exact: true })
    .click();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  await expect(row(page, child.id).getByRole("checkbox")).not.toBeChecked();
  const toast = page.locator(".undo-toast");
  await expect(toast).toContainText("„Lernprojekt abschließen“ abgeschlossen");
  await row(page, child.id).getByRole("checkbox").check();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  await expect(row(page, root.id).locator(".row__count")).toHaveText(
    "90/90 Min.",
  );
  // The toast takes the tick back, as on Heute.
  await expect(toast).toContainText("„Oberfläche entwickeln“ erledigt");
  await toast.getByRole("button", { name: "Rückgängig", exact: true }).click();
  // Reopening a child leaves the parent's own completion (and history) intact.
  await expect(row(page, child.id).getByRole("checkbox")).not.toBeChecked();
  await expect(row(page, root.id).getByRole("checkbox")).toBeChecked();
  await expect(row(page, root.id).locator(".row__count")).toHaveText(
    "0/90 Min.",
  );
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
  await openView(page, "Kampagnen");
  await expect(row(page, child.id)).toBeVisible();
});
test("Why: an Unter-Quest takes over the campaign's reason until it gets its own", async ({
  page,
  request,
}) => {
  const root = await campaign(request, "Halbmarathon");
  await request.patch(`${API_URL}/todos/${root.id}`, {
    data: { why: "Im März ins Ziel kommen" },
  });
  await open(page);
  await menuAction(
    page,
    root.id,
    "Halbmarathon",
    "Unter-Quest zu Halbmarathon hinzufügen",
  );
  const dialog = page.getByRole("dialog");
  // Quoted, not a text to edit: nothing can turn it into a copy by accident.
  const why = dialog.getByRole("group", { name: "Warum", exact: true });
  await expect(why.locator("blockquote")).toContainText(
    "Übernommen von „Halbmarathon“:",
  );
  await expect(why.locator("blockquote")).toContainText(
    "Im März ins Ziel kommen",
  );
  await expect(dialog.locator("[name=why]")).toHaveCount(0);
  await dialog.locator("[name=title]").fill("Laufschuhe kaufen");
  await dialog
    .getByRole("button", { name: "Quest erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();

  const todos = async () =>
    (await (await request.get(`${API_URL}/todos`)).json()) as {
      id: number;
      title: string;
      why: string | null;
      inheritedWhy: { text: string } | null;
    }[];
  const child = (await todos()).find((t) => t.title === "Laufschuhe kaufen")!;
  expect(child.why).toBeNull();
  expect(child.inheritedWhy?.text).toBe("Im März ins Ziel kommen");

  // The Questlog shows the inherited reason, and follows the campaign live.
  // The campaign itself is planned through its quests, so it is not listed.
  await request.patch(`${API_URL}/todos/${root.id}`, {
    data: { why: "Gesund ankommen" },
  });
  await openView(page, "Questlog");
  await expect(page.getByText("Gesund ankommen")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Laufschuhe kaufen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Halbmarathon", exact: true }),
  ).toHaveCount(0);

  // Writing an own reason, on purpose, gives the Unter-Quest its own.
  await openView(page, "Kampagnen");
  await row(page, child.id)
    .getByRole("button", { name: "Laufschuhe kaufen bearbeiten", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("button", { name: "Eigenes Warum schreiben", exact: true })
    .click();
  const own = editor.getByLabel("Eigenes Warum", { exact: true });
  await expect(own).toBeFocused();
  await expect(own).toHaveValue("");
  await own.fill("Ohne Blasen laufen");
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect((await todos()).find((t) => t.id === child.id)?.why).toBe(
    "Ohne Blasen laufen",
  );
});
test("Why: typing in the editor never detaches the inherited reason, and “Wieder übernehmen” restores it", async ({
  page,
  request,
}) => {
  const root = await campaign(request, "Buch schreiben");
  await request.patch(`${API_URL}/todos/${root.id}`, {
    data: { why: "Die Geschichte fertig erzählen" },
  });
  const child = await create(request, "Kapitel 3 überarbeiten", root.id);
  const stored = async () =>
    (await (await request.get(`${API_URL}/todos/${child.id}`)).json()) as {
      why: string | null;
      inheritedWhy: { text: string } | null;
    };
  await open(page);
  const edit = async () => {
    await row(page, child.id)
      .getByRole("button", {
        name: "Kapitel 3 überarbeiten bearbeiten",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("[name=title]")).toHaveValue(
      "Kapitel 3 überarbeiten",
    );
    return dialog;
  };

  // Every keystroke lands somewhere else: the quote is no field.
  let editor = await edit();
  const quote = editor.locator("blockquote");
  await expect(quote).toContainText("Die Geschichte fertig erzählen");
  await quote.click();
  await page.keyboard.type("Tippfehler");
  await editor.locator("[name=duration]").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.type("x");
  await expect(editor.locator("[name=why]")).toHaveCount(0);
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(await stored()).toMatchObject({
    why: null,
    inheritedWhy: { text: "Die Geschichte fertig erzählen" },
  });

  // An own reason on purpose, then taken back.
  editor = await edit();
  await editor
    .getByRole("button", { name: "Eigenes Warum schreiben", exact: true })
    .click();
  await page.keyboard.type("Weil es der Wendepunkt ist");
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect((await stored()).why).toBe("Weil es der Wendepunkt ist");

  editor = await edit();
  await expect(editor.getByLabel("Eigenes Warum", { exact: true })).toHaveValue(
    "Weil es der Wendepunkt ist",
  );
  await editor
    .getByRole("button", { name: "Wieder übernehmen", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Eigenes Warum schreiben", exact: true }),
  ).toBeFocused();
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect((await stored()).why).toBeNull();

  // After a reload it still inherits, live.
  await request.patch(`${API_URL}/todos/${root.id}`, {
    data: { why: "Die Geschichte endlich fertig erzählen" },
  });
  await page.reload();
  editor = await edit();
  await expect(editor.locator("blockquote")).toContainText(
    "Übernommen von „Buch schreiben“:",
  );
  await expect(editor.locator("blockquote")).toContainText(
    "Die Geschichte endlich fertig erzählen",
  );
  await expect(editor.locator("[name=why]")).toHaveCount(0);
});
test("Tree: accessible move to parent and root, edit duration, preserve own schedule", async ({
  page,
  isMobile,
  request,
}) => {
  const a = await campaign(request, "Backend verstehen"),
    b = await create(request, "Frontend verstehen"),
    leaf = await create(request, "Router lernen", b.id);
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
  await expect(row(page, leaf.id)).toHaveAttribute("data-depth", "2");
  await row(page, b.id)
    .getByRole("button", { name: "Frontend verstehen bearbeiten", exact: true })
    .click();
  await dialog.locator("[name=title]").fill("Vue verstehen");
  await dialog.locator("[name=duration]").fill("45");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toContainText("45 Min.");
  await menuAction(page, b.id, "Vue verstehen", "Vue verstehen verschieben");
  // With a quest below it, it becomes a campaign of its own at the top.
  await expect(dialog.locator('option[value=""]')).toHaveText(
    "Eigene Kampagne",
  );
  await dialog.getByRole("combobox").selectOption("");
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toHaveAttribute("data-depth", "0");
  // A single quest moved to the top is no campaign: it leaves the tree.
  await menuAction(page, leaf.id, "Router lernen", "Router lernen verschieben");
  await expect(dialog.locator('option[value=""]')).toHaveText(
    "Keine Kampagne (Questlog oder ihr Tag)",
  );
  await dialog.getByRole("combobox").selectOption("");
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, leaf.id)).toHaveCount(0);
  await openView(page, "Questlog");
  await expect(
    page.getByRole("heading", { name: "Router lernen", exact: true }),
  ).toBeVisible();
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
    "Lernprojekt mit allen Unter-Quests löschen",
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
    "Lernprojekt mit allen Unter-Quests löschen",
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
    "Lernprojekt mit allen Unter-Quests löschen",
  );
  await expect(dialog).toContainText("Neu hinzugefügt");
  await dialog
    .getByRole("button", { name: "Ja, löschen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Noch keine Kampagnen.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neue Kampagne", exact: true }),
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
    b = await campaign(request, "B"),
    child = await create(request, "Kind", a.id);
  // Room for the tiles above the tree, so both rows are on screen for the drag.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await open(page);
  // The tiles grow once their quest hours load; drag only after the tree settled.
  await expect(
    page.locator(`[data-campaign-tile="${b.id}"]`),
  ).toContainText("diese Woche");
  await row(page, a.id).dragTo(row(page, b.id));
  await expect(row(page, a.id)).toHaveAttribute("data-depth", "1");
  await expect(row(page, child.id)).toHaveAttribute("data-depth", "2");
  await row(page, b.id).dragTo(row(page, child.id));
  await expect(page.getByRole("alert")).toContainText("descendant");
});
test("Kampagnen: the tree holds campaigns only, an opened one starts below its card", async ({
  page,
  request,
}) => {
  const book = await create(request, "Buch schreiben");
  const series = await create(request, "Kapitel", book.id);
  const chapter = await create(request, "Kapitel 1", series.id);
  const marathon = await campaign(request, "Marathon im Frühjahr");
  const loose = await create(request, "Zahnarzt");
  await open(page);
  await expect(
    page.getByRole("heading", {
      name: "Kampagnen und ihre Quests",
      exact: true,
    }),
  ).toBeVisible();
  await expect(row(page, book.id)).toBeVisible();
  await expect(row(page, marathon.id)).toBeVisible();
  await expect(row(page, loose.id)).toHaveCount(0);

  await page
    .locator(`[data-campaign-tile="${book.id}"]`)
    .getByRole("button", { name: "Buch schreiben", exact: true })
    .click();
  await expect(page.locator("#campaign-detail-title")).toHaveText(
    "Buch schreiben",
  );
  // The card is the campaign; the tree begins with what lies below it.
  await expect(row(page, book.id)).toHaveCount(0);
  await expect(row(page, series.id)).toHaveAttribute("data-depth", "0");
  await expect(row(page, chapter.id)).toHaveAttribute("data-depth", "1");
  const card = page.locator(".campaign-detail");
  await card
    .getByRole("button", { name: "Aktionen für Buch schreiben", exact: true })
    .click();
  const menu = page.getByRole("menu", { name: "Buch schreiben", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Kampagne abschließen",
    "Bearbeiten",
    "Stoppuhr starten",
    "Unter-Quest hinzufügen",
    "Verschieben",
    "Löschen",
  ]);
  await menu
    .getByRole("menuitem", {
      name: "Unter-Quest zu Buch schreiben hinzufügen",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("[name=title]").fill("Lektorat suchen");
  await dialog
    .getByRole("button", { name: "Quest erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lektorat suchen", exact: true }),
  ).toBeVisible();
  await expect(card.getByRole("button", { name: /bearbeiten$/ })).toBeFocused();
});
