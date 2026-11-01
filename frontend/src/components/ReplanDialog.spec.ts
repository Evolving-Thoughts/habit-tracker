import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyReplan, getReplan, setDayEnd } from "../api/replan.api";
import ReplanDialog from "./ReplanDialog.vue";

vi.mock("../api/replan.api", () => ({
  getReplan: vi.fn(),
  applyReplan: vi.fn(),
  setDayEnd: vi.fn(),
}));
enableAutoUnmount(afterEach);

const preview = {
  confirmationToken: "a".repeat(64),
  dayEnd: "22:00",
  changes: [
    {
      todoId: 1,
      title: "Bericht",
      from: "2026-10-30T07:00:00.000Z",
      pieces: [{ start: "2026-10-30T07:00:00.000Z", minutes: 60 }],
      tomorrow: { start: "2026-10-31T07:00:00.000Z", minutes: 30 },
    },
  ],
};

async function render() {
  const wrapper = mount(ReplanDialog, {
    props: { returnFocus: () => null },
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
  await flushPromises();
  return wrapper;
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label)!;

describe("ReplanDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReplan).mockResolvedValue(preview);
  });

  it("shows the changes before anything is applied", async () => {
    const wrapper = await render();
    expect(wrapper.text()).toContain("Bericht");
    expect(wrapper.text()).toContain("Morgen 08:00 · 30 Min.");
    expect(applyReplan).not.toHaveBeenCalled();
  });

  it("applies the previewed proposal", async () => {
    const wrapper = await render();
    await button(wrapper, "Übernehmen").trigger("click");
    await flushPromises();
    expect(applyReplan).toHaveBeenCalledWith(preview.confirmationToken);
    expect(wrapper.emitted("applied")).toBeTruthy();
  });

  it("stores a new day end and reloads the proposal", async () => {
    const wrapper = await render();
    await wrapper.find('[data-test="day-end"]').setValue("20:30");
    await wrapper.find('[data-test="day-end"]').trigger("change");
    await flushPromises();
    expect(setDayEnd).toHaveBeenCalledWith("20:30");
    expect(getReplan).toHaveBeenCalledTimes(2);
  });

  it("has nothing to apply on a fitting day", async () => {
    vi.mocked(getReplan).mockResolvedValue({ ...preview, changes: [] });
    const wrapper = await render();
    expect(wrapper.text()).toContain("Der Tag passt");
    expect(button(wrapper, "Übernehmen").attributes("disabled")).toBeDefined();
  });

  it("shows a stale preview error", async () => {
    vi.mocked(applyReplan).mockRejectedValueOnce(new Error("Prüfe die Vorschau"));
    const wrapper = await render();
    await button(wrapper, "Übernehmen").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe("Prüfe die Vorschau");
    expect(wrapper.emitted("applied")).toBeFalsy();
  });
});
