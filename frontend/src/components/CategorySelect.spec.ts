import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories } from "../api/categories.api";
import CategorySelect from "./CategorySelect.vue";

vi.mock("../api/categories.api", () => ({ getCategories: vi.fn() }));
enableAutoUnmount(afterEach);

const labels = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll("option").map((option) => option.text());

describe("CategorySelect", () => {
  beforeEach(() => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, name: "Sport" }]);
  });

  it("offers none and the user's categories", async () => {
    const wrapper = mount(CategorySelect, { props: { id: "c" } });
    await flushPromises();
    expect(labels(wrapper)).toEqual(["Keine", "Sport"]);
  });

  it("offers the parent's category for a child", async () => {
    const wrapper = mount(CategorySelect, {
      props: { id: "c", inheritsFromParent: true },
    });
    await flushPromises();
    expect(labels(wrapper)).toEqual([
      "Wie übergeordnetes Todo",
      "Keine",
      "Sport",
    ]);
  });

  it("stays usable when the list cannot be loaded", async () => {
    vi.mocked(getCategories).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = mount(CategorySelect, { props: { id: "c" } });
    await flushPromises();
    expect(labels(wrapper)).toEqual(["Keine"]);
  });
});
