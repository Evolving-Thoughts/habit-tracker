import { describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { VIEWS, createAppRouter, isChunkError } from "./router";
import TodayView from "./views/TodayView.vue";

describe("router", () => {
  it("brings Heute with the main bundle and loads every other view on demand", () => {
    for (const view of VIEWS) {
      if (view.name === "today") expect(view.component).toBe(TodayView);
      else expect(typeof view.component).toBe("function");
    }
  });

  it("loads a lazy view when it is opened", async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push({ name: "plan" });
    const record = router.currentRoute.value.matched[0]!;
    expect((record.components!.default as { __name?: string }).__name).toBe(
      "PlanView",
    );
  });

  it("knows a missing view chunk in every browser's words", () => {
    expect(
      isChunkError(new TypeError("Failed to fetch dynamically imported module: /a.js")),
    ).toBe(true);
    expect(isChunkError(new TypeError("error loading dynamically imported module"))).toBe(
      true,
    );
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError(new Error("Die Quest konnte nicht geladen werden."))).toBe(false);
    expect(isChunkError("dynamically imported module")).toBe(false);
  });
});
