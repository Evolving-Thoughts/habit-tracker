import { test, expect } from "./fixtures";
import { createTodo, list, today, visit } from "./helpers";

test("Neu planen previews a missed Todo and moves it only after confirming", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await visit(page, "Heute");
  await createTodo(page, "Liegen geblieben", `${date}T00:00`);
  const scheduled = async () =>
    ((await list(request, "todos"))[0] as { scheduledAt: string }).scheduledAt;
  const before = await scheduled();

  await page.getByRole("button", { name: "Neu planen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Liegen geblieben")).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await scheduled()).toBe(before);

  await page.getByRole("button", { name: "Neu planen", exact: true }).click();
  await expect(dialog.getByText("Liegen geblieben")).toBeVisible();
  await dialog.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(scheduled).not.toBe(before);
});
