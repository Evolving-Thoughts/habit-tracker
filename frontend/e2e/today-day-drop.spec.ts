import { daysAfter, dropCardOn, today } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { APIRequestContext, Page } from "@playwright/test";

const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};
const read = async (request: APIRequestContext, id: number) =>
  (await (await request.get(`${API_URL}/todos/${id}`)).json()) as {
    scheduledDate: string | null;
    timeOfDay: string | null;
  };
const dayOf = async (request: APIRequestContext, id: number) =>
  (await read(request, id)).scheduledDate;
const card = (page: Page, list: string, title: string) =>
  page
    .locator(`${list} .planner-item`)
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test("Heute: a card dropped on Auf morgen moves there, and back onto Heute from tomorrow", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging is covered with the mouse; phones use the same code path by touch.",
  );
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Erstes", scheduledDate: date });
  const second = await plan(request, { title: "Zweites", scheduledDate: date });
  const meeting = await plan(request, {
    title: "Abstimmung",
    scheduledDate: date,
    timeOfDay: "23:00",
  });
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Erstes");
  const head = page.locator(".today-view__header");

  // ‹ › close the head; "Auf morgen" before them takes the card.
  const ahead = head.getByRole("button", {
    name: "Offenes auf morgen verschieben",
  });
  await dropCardOn(page, card(page, ".order", "Zweites"), ahead);
  await expect.poll(() => dayOf(request, second.id)).toBe(tomorrow);
  await expect(card(page, ".order", "Zweites")).toHaveCount(0);
  await expect(page.locator(".today-view__notice")).toHaveText(
    "„Zweites“ steht jetzt bei morgen.",
  );

  // An appointment moves with its time, without a question.
  await dropCardOn(page, card(page, ".order", "Abstimmung"), ahead);
  await expect.poll(() => read(request, meeting.id)).toMatchObject({
    scheduledDate: tomorrow,
    timeOfDay: "23:00",
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // From tomorrow, "Heute" in the head takes it back.
  await head.getByRole("button", { name: "Nächster Tag" }).click();
  await expect(page).toHaveURL(new RegExp(`tag=${tomorrow}`));
  await dropCardOn(
    page,
    card(page, ".other-day__list", "Zweites"),
    head.getByRole("button", { name: "Heute", exact: true }),
  );
  await expect.poll(() => dayOf(request, second.id)).toBe(date);
  await expect(card(page, ".other-day__list", "Zweites")).toHaveCount(0);
});
