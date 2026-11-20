import { openView, pick } from "./helpers";
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
 * top-level quest is no campaign and gets no tile.
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
/** A campaign's own page: its detail card and the tree of its quests. */
const openCampaign = async (page: Page, id: number) => {
  await page.goto(`/#/kampagnen?kampagne=${id}`);
  await expect(page.locator("#campaign-detail-title")).toBeVisible();
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
/** The same menu on an opened campaign's detail card. */
const cardMenuAction = async (page: Page, title: string, name: string) => {
  await page
    .locator(".campaign-detail")
    .getByRole("button", { name: `Aktionen für ${title}`, exact: true })
    .click();
  await page
    .getByRole("menu", { name: title, exact: true })
    .getByRole("menuitem", { name, exact: true })
    .click();
};

test("Kampagne: a new quest from its page, collapse, the visible Abschließen and reopening persist", async ({
  page,
  request,
}) => {
  const root = await campaign(request, "Lernprojekt abschließen");
  await openCampaign(page, root.id);
  // The plus button inside a campaign adds a quest to it.
  await page
    .getByRole("button", {
      name: "Neue Quest in „Lernprojekt abschließen“",
      exact: true,
    })
    .click();
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
  const card = page.locator(".campaign-detail");
  // Progress counts the quest below, not the campaign's own 30 minutes.
  await expect(card.locator(".campaign-detail__count")).toHaveText(
    "0 von 1 Quest · 0 von 90 Min.",
  );
  // The campaign still has an open quest: it asks first, the quest stays open.
  const complete = card.getByRole("button", {
    name: "Kampagne Lernprojekt abschließen abschließen",
    exact: true,
  });
  await complete.click();
  const question = page.getByRole("dialog", { name: "Kampagne abschließen?" });
  await expect(question).toContainText(
    "1 Quest in „Lernprojekt abschließen“ ist noch offen. Sie bleibt offen",
  );
  await question
    .getByRole("button", { name: "Abbrechen", exact: true })
    .click();
  await expect(question).toHaveCount(0);
  await expect(card.locator(".campaign-detail__state")).toHaveCount(0);
  await complete.click();
  await question
    .getByRole("button", { name: "Kampagne abschließen", exact: true })
    .click();
  await expect(card.locator(".campaign-detail__state")).toHaveText(
    "Abgeschlossen",
  );
  await expect(row(page, child.id).getByRole("checkbox")).not.toBeChecked();
  const toast = page.locator(".undo-toast");
  await expect(toast).toContainText("„Lernprojekt abschließen“ abgeschlossen");
  await row(page, child.id).getByRole("checkbox").check();
  await expect(card.locator(".campaign-detail__count")).toHaveText(
    "1 von 1 Quest · 90 von 90 Min.",
  );
  // The toast takes the tick back, as on Heute.
  await expect(toast).toContainText("„Oberfläche entwickeln“ erledigt");
  await toast.getByRole("button", { name: "Rückgängig", exact: true }).click();
  // Reopening a child leaves the campaign's own completion intact.
  await expect(row(page, child.id).getByRole("checkbox")).not.toBeChecked();
  await expect(card.locator(".campaign-detail__state")).toHaveText(
    "Abgeschlossen",
  );
  await card
    .getByRole("button", {
      name: "Kampagne Lernprojekt abschließen wieder öffnen",
      exact: true,
    })
    .click();
  await expect(card.locator(".campaign-detail__state")).toHaveCount(0);

  // A quest series collapses and expands in the campaign's tree.
  const step = await create(request, "Formulare bauen", child.id);
  await page.reload();
  await expect(row(page, step.id)).toBeVisible();
  await row(page, child.id)
    .getByRole("button", {
      name: "Oberfläche entwickeln einklappen",
      exact: true,
    })
    .click();
  await expect(row(page, step.id)).toHaveCount(0);
  await row(page, child.id)
    .getByRole("button", {
      name: "Oberfläche entwickeln ausklappen",
      exact: true,
    })
    .click();
  await expect(row(page, step.id)).toBeVisible();
});
test("Why: an Unter-Quest takes over the campaign's reason until it gets its own", async ({
  page,
  request,
}) => {
  const root = await campaign(request, "Halbmarathon");
  await request.patch(`${API_URL}/todos/${root.id}`, {
    data: { why: "Im März ins Ziel kommen" },
  });
  await openCampaign(page, root.id);
  await cardMenuAction(
    page,
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
  await openCampaign(page, root.id);
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
  await openCampaign(page, root.id);
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
  // Frontend verstehen is a campaign by its quest: its card moves it.
  await openCampaign(page, b.id);
  await cardMenuAction(
    page,
    "Frontend verstehen",
    "Frontend verstehen in eine Kampagne verschieben",
  );
  const dialog = page.getByRole("dialog");
  const parent = dialog.getByRole("combobox", { name: "Gehört zu" });
  // Touch screens keep the keyboard closed until the field is tapped.
  await expect(isMobile ? dialog : parent).toBeFocused();
  await pick(parent, "Backend");
  await expect(parent).toHaveValue("Backend verstehen");
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  // Below another campaign it is one no more; it stands in that one's tree.
  await openCampaign(page, a.id);
  await expect(row(page, b.id)).toHaveAttribute("data-depth", "0");
  await expect(row(page, leaf.id)).toHaveAttribute("data-depth", "1");
  await row(page, b.id)
    .getByRole("button", { name: "Frontend verstehen bearbeiten", exact: true })
    .click();
  await dialog.locator("[name=title]").fill("Vue verstehen");
  await dialog.locator("[name=duration]").fill("45");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toContainText("45 Min.");
  await menuAction(
    page,
    b.id,
    "Vue verstehen",
    "Vue verstehen in eine Kampagne verschieben",
  );
  // With a quest below it, it becomes a campaign of its own at the top.
  await parent.fill("Keine");
  await expect(
    dialog.getByRole("option", { name: "Keine (eigene Kampagne)" }),
  ).toBeVisible();
  await parent.press("Enter");
  await dialog
    .getByRole("button", { name: "Verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, b.id)).toHaveCount(0);
  // A single quest moved to the top is no campaign: it leaves the tree.
  await openCampaign(page, b.id);
  await menuAction(
    page,
    leaf.id,
    "Router lernen",
    "Router lernen in eine Kampagne verschieben",
  );
  await parent.fill("Keine");
  await expect(
    dialog.getByRole("option", { name: "Keine (lose Quest)" }),
  ).toBeVisible();
  await parent.press("Enter");
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
  await openCampaign(page, root.id);
  await cardMenuAction(
    page,
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
  await cardMenuAction(
    page,
    "Lernprojekt",
    "Lernprojekt mit allen Unter-Quests löschen",
  );
  await expect(dialog).toBeVisible();
  await create(request, "Neu hinzugefügt", root.id);
  await dialog
    .getByRole("button", { name: "Ja, löschen", exact: true })
    .click();
  // The dialog stays, says why and shows the fresh preview to review.
  await expect(dialog.getByRole("alert")).toContainText("preview");
  await expect(dialog).toContainText("Neu hinzugefügt");
  await dialog
    .getByRole("button", { name: "Ja, löschen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  // The campaign is gone: the overview offers a new one.
  await expect(
    page.getByText("Keine aktive Kampagne.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".campaign-tile__create")).toBeVisible();
});
test("Tree: drag subtree between parents; invalid cycle is rejected", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Touch uses the tested move dialog",
  );
  const home = await campaign(request, "Umzug"),
    a = await create(request, "A", home.id),
    b = await create(request, "B", home.id),
    child = await create(request, "Kind", a.id);
  // Room for the card above the tree, so the rows are on screen for the drag.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openCampaign(page, home.id);
  await expect(row(page, child.id)).toBeVisible();
  await row(page, a.id).dragTo(row(page, b.id));
  await expect(row(page, a.id)).toHaveAttribute("data-depth", "1");
  await expect(row(page, child.id)).toHaveAttribute("data-depth", "2");
  await row(page, b.id).dragTo(row(page, child.id));
  await expect(page.getByRole("alert")).toContainText("descendant");
});
test("Kampagnen: the overview shows figures and tiles; a campaign's quests show on its page", async ({
  page,
  request,
}) => {
  const book = await create(request, "Buch schreiben");
  const series = await create(request, "Kapitel", book.id);
  const chapter = await create(request, "Kapitel 1", series.id);
  const marathon = await campaign(request, "Marathon im Frühjahr");
  const loose = await create(request, "Zahnarzt");
  await open(page);
  await expect(page.locator(`[data-campaign-tile="${book.id}"]`)).toBeVisible();
  await expect(
    page.locator(`[data-campaign-tile="${marathon.id}"]`),
  ).toBeVisible();
  await expect(page.locator(`[data-campaign-tile="${loose.id}"]`)).toHaveCount(
    0,
  );
  // No tree on the overview: the quests live inside their campaign.
  await expect(page.locator("[data-todo-id]")).toHaveCount(0);
  await expect(page.locator('[data-stat="active"] dd')).toHaveText("2");
  await expect(page.locator('[data-stat="done"] dd')).toHaveText("0");

  // The dashed tile after the tiles makes a new campaign.
  await page.locator(".campaign-tile__create").click();
  const dialog = page.getByRole("dialog", { name: "Neue Kampagne" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog).toHaveCount(0);

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
  await expect(
    card.getByRole("button", {
      name: "Kampagne Buch schreiben abschließen",
      exact: true,
    }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Aktionen für Buch schreiben", exact: true })
    .click();
  const menu = page.getByRole("menu", { name: "Buch schreiben", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Kampagne abschließen",
    "Bearbeiten",
    "Stoppuhr starten",
    "Unter-Quest hinzufügen",
    "In Kampagne verschieben …",
    "Löschen",
  ]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Neue Quest in „Buch schreiben“", exact: true })
    .click();
  const create_ = page.getByRole("dialog", { name: "Neue Quest" });
  await create_.locator("[name=title]").fill("Lektorat suchen");
  await create_
    .getByRole("button", { name: "Quest erstellen", exact: true })
    .click();
  await expect(create_).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lektorat suchen", exact: true }),
  ).toBeVisible();
});
