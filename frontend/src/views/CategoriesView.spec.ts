import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  deleteCategory,
  getCategories,
  renameCategory,
  setCategoryTarget,
} from "../api/categories.api";
import CategoriesView from "./CategoriesView.vue";

vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  setCategoryTarget: vi.fn(),
  deleteCategory: vi.fn(),
}));
enableAutoUnmount(afterEach);

async function render() {
  const wrapper = mount(CategoriesView);
  await flushPromises();
  return wrapper;
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, label: string) =>
  wrapper
    .findAll("button")
    .find(
      (item) =>
        item.text() === label || item.attributes("aria-label") === label,
    )!;

describe("CategoriesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 1, name: "Sport" }]);
  });

  it("adds a category", async () => {
    const wrapper = await render();
    await wrapper.find('input[name="name"]').setValue(" Musik ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(createCategory).toHaveBeenCalledWith("Musik");
  });

  it("renames a category", async () => {
    const wrapper = await render();
    await button(wrapper, "Sport umbenennen").trigger("click");
    await wrapper
      .find('input[aria-label="Neuer Name für Sport"]')
      .setValue("Fit");
    await button(wrapper, "Speichern").trigger("click");
    await wrapper.findAll("form")[1].trigger("submit");
    await flushPromises();
    expect(renameCategory).toHaveBeenCalledWith(1, "Fit");
  });

  it("deletes only after a confirmation", async () => {
    const wrapper = await render();
    await button(wrapper, "Sport löschen").trigger("click");
    expect(deleteCategory).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("bleiben ohne Kategorie erhalten");
    await button(wrapper, "Löschen").trigger("click");
    await flushPromises();
    expect(deleteCategory).toHaveBeenCalledWith(1);
  });

  it("saves and clears the weekly target", async () => {
    vi.useFakeTimers();
    const wrapper = await render();
    const input = wrapper.find('input[aria-label="Wochensoll für Sport"]');
    await input.setValue("3");
    await input.trigger("change");
    await flushPromises();
    expect(setCategoryTarget).toHaveBeenCalledWith(1, 3);
    const status = wrapper.find('[aria-live="polite"]');
    expect(status.text()).toBe("Gespeichert");
    vi.advanceTimersByTime(2000);
    await flushPromises();
    expect(wrapper.find('[aria-live="polite"]').text()).toBe("");
    vi.useRealTimers();
    await input.setValue("");
    await input.trigger("change");
    await flushPromises();
    expect(setCategoryTarget).toHaveBeenCalledWith(1, null);
  });

  it("shows a failed weekly target save next to the field", async () => {
    vi.mocked(setCategoryTarget).mockRejectedValueOnce(
      new Error("Nicht gespeichert"),
    );
    const wrapper = await render();
    const input = wrapper.find('input[aria-label="Wochensoll für Sport"]');
    await input.setValue("2");
    await flushPromises();
    expect(wrapper.find(".form-error").text()).toBe("Nicht gespeichert");
    expect(wrapper.find('[aria-live="polite"]').text()).toBe("");
  });

  it("rejects a weekly target below one without saving", async () => {
    const wrapper = await render();
    const input = wrapper.find('input[aria-label="Wochensoll für Sport"]');
    await input.setValue("0");
    expect(setCategoryTarget).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').text()).toContain("ganze Zahl");
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(getCategories).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = await render();
    expect(wrapper.find(".alert").text()).toContain("Offline");
    await button(wrapper, "Erneut versuchen").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Sport");
  });

  it("shows a server error", async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(new Error("Gibt es schon"));
    const wrapper = await render();
    await wrapper.find('input[name="name"]').setValue("Sport");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe("Gibt es schon");
  });
});
