import { daysAfter, today } from "./helpers";
import { test, expect } from "./fixtures";

test("Heute: leaf to tomorrow, plan a quest there, look at yesterday and come back", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await page.goto("/");
  const head = page.locator(".today-view__header");
  await head.getByRole("button", { name: "Nächster Tag" }).click();
  await expect(page).toHaveURL(new RegExp(`tag=${daysAfter(date, 1)}`));
  await expect(page.locator(".today-view__relation")).toHaveText("Morgen");
  await expect(page.locator(".focus")).toHaveCount(0);
  await expect(page.getByText("Für morgen ist noch nichts geplant.")).toBeVisible();

  const field = page.getByRole("textbox", { name: "Quest für morgen hinzufügen" });
  await field.fill("Arzt anrufen");
  await field.press("Enter");
  await expect(
    page.locator(".other-day__list .planner-item").filter({
      hasText: "Arzt anrufen",
    }),
  ).toBeVisible();
  await expect(page.getByText("1 geplant")).toBeVisible();

  await head.getByRole("button", { name: "Voriger Tag" }).click();
  await head.getByRole("button", { name: "Voriger Tag" }).click();
  await expect(page.locator(".today-view__relation")).toHaveText("Gestern");
  // A day that is over takes no new quests; it shows what was done.
  await expect(
    page.getByText("An diesem Tag ist nichts erledigt worden."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /hinzufügen/ }),
  ).toHaveCount(0);

  await head.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(page).not.toHaveURL(/tag=/);
  await expect(page.locator(".today-view__relation")).toHaveCount(0);
});
