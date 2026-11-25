import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import { today } from "./helpers";

/*
 * The e2e backend serves silent fixture files for "rain" and "chime-done"
 * (backend/test/fixtures/sounds). Whether a headless browser really makes
 * sound is not the point: the spec follows the player's state and checks
 * that every audio element is paused once the sound should be off.
 */
const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
};

/** Keeps every audio element the page creates, to ask whether one still plays. */
async function watchAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const created: HTMLAudioElement[] = [];
    const Tracked = function (src?: string) {
      const audio = new NativeAudio(src);
      created.push(audio);
      return audio;
    } as unknown as typeof Audio;
    Tracked.prototype = NativeAudio.prototype;
    window.Audio = Tracked;
    (window as unknown as { audios: HTMLAudioElement[] }).audios = created;
  });
}
const anyPlaying = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { audios: HTMLAudioElement[] }).audios.some(
      (audio) => !audio.paused,
    ),
  );

test("Fokus-Klänge: a chosen sound runs with the stopwatch, M switches it, leaving ends it", async ({
  page,
  request,
}) => {
  await plan(request, {
    title: "Kapitel schreiben",
    scheduledDate: await today(request),
  });
  await watchAudio(page);
  await page.goto("/#/fokus");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kapitel schreiben",
  );

  const sound = page.locator("[data-sound-state]");
  await expect(sound).toHaveAttribute("data-sound-state", "off");
  await expect(sound).toHaveAccessibleName("Klang: aus");

  // Chosen before the start: it waits for the stopwatch.
  await sound.click();
  await page.getByRole("radio", { name: "Regen" }).check();
  await expect(sound).toHaveAttribute("data-sound-state", "paused");
  await expect(page.getByLabel("Lautstärke")).toHaveValue("60");
  // Escape closes the panel and stays in the Fokus-Modus.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio", { name: "Regen" })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/fokus$/);

  const file = page.waitForResponse((response) =>
    response.url().includes("/api/sounds/rain?v="),
  );
  await page.getByRole("button", { name: "Starten", exact: true }).click();
  await expect(sound).toHaveAttribute("data-sound-state", "playing");
  // The state in words: the title of what plays.
  await expect(sound).toHaveText("Regen");
  expect((await file).ok()).toBe(true);

  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  await expect(sound).toHaveAttribute("data-sound-state", "paused");
  await expect(sound).toHaveText("Klang");
  await expect.poll(() => anyPlaying(page)).toBe(false);

  // M: off while the stopwatch waits, then on again with the last sound.
  await page.locator("main").focus();
  await page.keyboard.press("m");
  await expect(sound).toHaveAttribute("data-sound-state", "off");
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await expect(page.getByText("Läuft", { exact: true })).toBeVisible();
  await expect(sound).toHaveAttribute("data-sound-state", "off");
  await page.locator("main").focus();
  await page.keyboard.press("m");
  await expect(sound).toHaveAttribute("data-sound-state", "playing");
  await expect(sound).toHaveText("Regen");

  // Leaving the Fokus-Modus ends the sound; the stopwatch runs on.
  await page.getByRole("link", { name: "Heute", exact: true }).click();
  await expect(page).toHaveURL(/#\/heute$/);
  await expect.poll(() => anyPlaying(page)).toBe(false);
  await expect(
    page.getByRole("complementary", { name: "Aktuelle Stoppuhr" }),
  ).toContainText("Kapitel schreiben");
});

test("Fokus-Klänge: chosen per device in Einstellungen", async ({ page }) => {
  await page.goto("/#/einstellungen");
  const section = page.getByRole("region", { name: "Fokus-Klänge" });
  await expect(section).toBeVisible();
  // Only the files the server has: here the "rain" fixture.
  const choice = section.getByRole("combobox", { name: "Klang" });
  await expect(choice.locator("option")).toHaveText(["Aus", "Regen"]);
  await choice.selectOption({ label: "Regen" });
  const stored = await page.evaluate(() => localStorage.getItem("focus:sound"));
  expect(JSON.parse(stored!)).toMatchObject({ soundId: "rain" });

  // The short sounds have their own switch, "Töne", in place of the chimes.
  await expect(section.getByRole("checkbox")).toHaveCount(0);
  const tones = page.getByRole("region", { name: "Töne" });
  const toggle = tones.getByRole("switch", { name: "Töne" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(tones.getByRole("slider", { name: "Lautstärke der Töne" })).toBeDisabled();
  const effects = await page.evaluate(() =>
    localStorage.getItem("sounds:effects"),
  );
  expect(JSON.parse(effects!)).toMatchObject({ enabled: false });

  await page.goto("/#/fokus");
  await expect(page.locator("[data-sound-state]")).toHaveAttribute(
    "data-sound-state",
    "paused",
  );
});
