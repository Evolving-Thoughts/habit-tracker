import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../push/device", () => ({
  supported: vi.fn(),
  pushConfig: vi.fn(),
  restorePush: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
}));
vi.mock("../push/preferences", () => ({ readPreference: vi.fn() }));
import {
  supported,
  pushConfig,
  restorePush,
  enablePush,
  disablePush,
} from "../push/device";
import { readPreference } from "../push/preferences";
import PushSettings from "./PushSettings.vue";
let preference = { enabled: false, subscriptionId: null as string | null };
enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.clearAllMocks();
  preference = { enabled: false, subscriptionId: null };
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.mocked(supported).mockReturnValue(true);
  vi.mocked(pushConfig).mockResolvedValue({
    configured: true,
    publicKey: "test-public-key",
  });
  vi.mocked(restorePush).mockResolvedValue();
  vi.mocked(readPreference).mockImplementation(async () => ({ ...preference }));
  vi.mocked(enablePush).mockImplementation(async () => {
    preference = { enabled: true, subscriptionId: "opaque-id" };
  });
  vi.mocked(disablePush).mockImplementation(async () => {
    preference = { enabled: false, subscriptionId: null };
  });
});
afterEach(() => vi.unstubAllGlobals());
async function open() {
  const wrapper = mount(PushSettings);
  await flushPromises();
  return wrapper;
}
describe("Push settings", () => {
  it("starts disabled, explains neutral per-device messages and activates only after a click", async () => {
    const wrapper = await open();
    expect(enablePush).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("ohne Quest- oder Daily-Titel");
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(enablePush).toHaveBeenCalledWith(
      { configured: true, publicKey: "test-public-key" },
      true,
    );
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
  });
  it("disables an enabled device", async () => {
    preference = { enabled: true, subscriptionId: "opaque-id" };
    const wrapper = await open();
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(disablePush).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
  });
  it("explains blocked browser permissions instead of opening another prompt", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    const wrapper = await open();
    expect(wrapper.text()).toContain("Website-Einstellungen");
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });
  it("shows unavailable server configuration without disabling normal app navigation", async () => {
    vi.mocked(pushConfig).mockResolvedValue({
      configured: false,
      publicKey: null,
    });
    const wrapper = await open();
    expect(wrapper.text()).toContain("Server noch nicht eingerichtet");
    // Whoever runs the server learns what is missing and where to read up.
    expect(wrapper.text()).toContain("Frag die Person, die den Server betreibt.");
    expect(wrapper.text()).not.toContain("VAPID");
    expect(wrapper.text()).not.toContain("docs/betrieb.md");
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });
  it("says before the first switch that the browser will ask", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    const wrapper = await open();
    const toggle = wrapper.get('[role="switch"]');
    expect(
      wrapper.get(`#${toggle.attributes("aria-describedby")}`).text(),
    ).toBe(
      "Der Browser fragt gleich, ob die App dir Benachrichtigungen schicken darf.",
    );
  });
  it("shows the way back instead of an error when the prompt is refused", async () => {
    const notification = { permission: "default" as NotificationPermission };
    vi.stubGlobal("Notification", notification);
    vi.mocked(enablePush).mockImplementationOnce(async () => {
      notification.permission = "denied";
      throw new Error("Benachrichtigungen sind im Browser nicht erlaubt.");
    });
    const wrapper = await open();
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    const steps = wrapper.findAll(".push-settings__steps li");
    expect(steps.map((step) => step.get("strong").text())).toEqual([
      "Chrome:",
      "Edge:",
      "Firefox:",
      "Android, als installierte App:",
    ]);
    expect(wrapper.text()).not.toContain("Der Browser fragt gleich");
  });
  it("reports offline opt-out cleanup and retains local disabled state", async () => {
    preference = { enabled: true, subscriptionId: "opaque-id" };
    vi.mocked(disablePush).mockImplementationOnce(async () => {
      preference.enabled = false;
      throw new Error("Server-Bereinigung ausstehend");
    });
    const wrapper = await open();
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("ausstehend");
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
  });
  it("prevents duplicate activation while a request is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(enablePush).mockImplementationOnce(() => gate);
    const wrapper = await open();
    await wrapper.get('[role="switch"]').trigger("click");
    expect(wrapper.get('[role="switch"]').attributes("disabled")).toBeDefined();
    release();
    await flushPromises();
    expect(enablePush).toHaveBeenCalledOnce();
  });
});
