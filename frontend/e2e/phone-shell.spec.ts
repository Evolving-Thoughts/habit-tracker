import { expect, test } from "./fixtures";
import { API_URL } from "./environment";
import { openView, visit } from "./helpers";

/*
 * The app's frame on a phone: the stopwatch docked above the tab bar, Suchen
 * behind Mehr, dialogs as sheets from the bottom.
 */
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, "The phone's frame, checked on the phone project.");
});

async function createQuest(
  request: import("@playwright/test").APIRequestContext,
  title: string,
): Promise<number> {
  const response = await request.post(`${API_URL}/todos`, {
    data: { title, plannedDurationMinutes: 25 },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: number }).id;
}

test("phone: the stopwatch bar is docked above the tab bar, one line, and makes room", async ({
  page,
  request,
}) => {
  const id = await createQuest(request, "Steuererklärung sortieren");
  expect(
    (
      await request.post(`${API_URL}/timers`, {
        data: { kind: "todo", targetId: id },
      })
    ).status(),
  ).toBe(201);
  await visit(page, "Questlog");
  const bar = page.getByRole("complementary", { name: "Aktuelle Stoppuhr" });
  await expect(bar).toContainText("Steuererklärung sortieren");
  const viewport = page.viewportSize()!;
  const tabBar = (await page.locator(".tab-bar").boundingBox())!;
  const box = (await bar.boundingBox())!;
  // Right above the tab bar, with a small gap, inside the window.
  expect(box.y + box.height).toBeLessThanOrEqual(tabBar.y);
  expect(tabBar.y - (box.y + box.height)).toBeLessThanOrEqual(12);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  // One line: pause and "…" sit in the same row as the title, on the right.
  const pause = (await bar
    .getByRole("button", { name: "Stoppuhr pausieren", exact: true })
    .boundingBox())!;
  const more = (await bar
    .getByRole("button", { name: "Weitere Aktionen der Stoppuhr", exact: true })
    .boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(72);
  expect(Math.abs(pause.y - more.y)).toBeLessThanOrEqual(1);
  expect(more.x + more.width).toBeGreaterThan(viewport.width - 64);
  // Its height, gap included, is what the page and the plus button make room for.
  const room = await page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--timer-bar-height",
      ),
    ),
  );
  expect(room).toBeGreaterThanOrEqual(box.height);
  expect(room).toBeLessThanOrEqual(box.height + 12);
  const plus = (await page.locator(".create-button").boundingBox())!;
  expect(plus.y + plus.height).toBeLessThan(box.y);

  // A view that shows the stopwatch large keeps no bar and no room for it.
  await openView(page, "Fokus");
  await expect(bar).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--timer-bar-height")
          .trim(),
      ),
    )
    .toBe("0px");
});

test("phone: Mehr starts with Suchen, which opens the command menu ready to type", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Ansichten" });
  await navigation.getByRole("button", { name: "Mehr", exact: true }).click();
  const sheet = page.locator("#more-views");
  await expect(sheet).toBeVisible();
  // A sheet on the bottom edge, as wide as the window.
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return [Math.round(box.y + box.height), Math.round(box.width)];
    })
    .toEqual([viewport.height, viewport.width]);
  const first = sheet.locator(".tab-bar__tab").first();
  await expect(first).toHaveText("Suchen");
  await first.click();
  const menu = page.getByRole("dialog", { name: "Befehle" });
  await expect(menu).toBeVisible();
  await expect(sheet).toBeHidden();
  // The intent is clear: the field takes the focus on a touch screen too.
  await expect(
    menu.getByRole("combobox", {
      name: "Ansichten, Befehle, Titel und Notizen durchsuchen",
    }),
  ).toBeFocused();
  // No key caps where no keyboard is likely.
  await expect(menu.locator("kbd")).toHaveCount(0);
  await page.keyboard.type("Plan");
  await expect(
    menu.getByRole("option", { name: /Plan/ }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(
    navigation.getByRole("button", { name: "Mehr", exact: true }),
  ).toBeFocused();
});

test("phone: the quest editor is a sheet from the bottom that a drag down closes", async ({
  page,
  request,
}) => {
  await createQuest(request, "Fahrrad putzen");
  await visit(page, "Questlog");
  const open = page.getByRole("button", {
    name: "Fahrrad putzen bearbeiten",
    exact: true,
  });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Quest bearbeiten" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="title"]')).toHaveValue("Fahrrad putzen");
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!;
      return Math.round(box.y + box.height);
    })
    .toBe(viewport.height);
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.x)).toBe(0);
  expect(Math.round(box.width)).toBe(viewport.width);
  await expect(dialog.locator(".modal-dialog__grabber")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Dialog schließen" }),
  ).toBeVisible();
  // Saving stays in the sticky footer; the way to deletion ends the content.
  const footer = dialog.locator('[data-test="editor-actions"]');
  await expect(
    footer.getByRole("button", { name: "Speichern", exact: true }),
  ).toBeVisible();
  await expect(footer.locator('[data-test="request-delete"]')).toHaveCount(0);
  await expect(dialog.locator('[data-test="request-delete"]')).toHaveText(
    "Quest löschen",
  );

  // A short drag on the title springs back, a long one closes.
  const header = (await dialog.locator(".modal-dialog__header").boundingBox())!;
  const x = header.x + header.width / 3;
  const y = header.y + header.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 3 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 160, { steps: 6 });
  await page.mouse.up();
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});
