import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthView from "./AuthView.vue";
import * as auth from "../api/auth.api";
vi.mock("../api/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resendVerification: vi.fn(),
  verifyEmail: vi.fn(),
  resetPassword: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
describe("AuthView", () => {
  it("shows and hides both password fields with one switch", async () => {
    const wrapper = mount(AuthView);
    const toggle = () => wrapper.get(".password-field__toggle");
    const type = (name: string) =>
      (wrapper.get(`[name=${name}]`).element as HTMLInputElement).type;
    expect(type("password")).toBe("password");
    expect(toggle().attributes("aria-pressed")).toBe("false");
    expect(toggle().attributes("aria-label")).toBe("Passwort anzeigen");
    await toggle().trigger("click");
    expect(type("password")).toBe("text");
    expect(toggle().attributes("aria-label")).toBe("Passwort verbergen");

    // Registering: the repeat field follows the same switch, which starts off.
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Konto erstellen")!
      .trigger("click");
    expect(type("password")).toBe("password");
    expect(type("confirmation")).toBe("password");
    await toggle().trigger("click");
    expect(type("password")).toBe("text");
    expect(type("confirmation")).toBe("text");
    expect(toggle().attributes("aria-controls")).toBe(
      "auth-password auth-confirm",
    );
  });
  it("logs in and clears the password", async () => {
    vi.mocked(auth.login).mockResolvedValue({
      id: "a",
      email: "a@example.test",
    });
    const wrapper = mount(AuthView);
    await wrapper.get("[name=email]").setValue("a@example.test");
    await wrapper.get("[name=password]").setValue("a-long-password");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.emitted("authenticated")?.[0]).toEqual([
      { id: "a", email: "a@example.test" },
    ]);
    expect(
      (wrapper.get("[name=password]").element as HTMLInputElement).value,
    ).toBe("");
  });
  it("does not register mismatched passwords", async () => {
    const wrapper = mount(AuthView);
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Konto erstellen")!
      .trigger("click");
    await wrapper.get("[name=email]").setValue("a@example.test");
    await wrapper.get("[name=password]").setValue("a-long-password");
    await wrapper.get("[name=confirmation]").setValue("different-password");
    await wrapper.get("form").trigger("submit");
    expect(auth.register).not.toHaveBeenCalled();
    expect(wrapper.get("[role=alert]").text()).toContain("stimmen nicht");
  });
  it("requires an explicit click to verify a link", async () => {
    vi.mocked(auth.verifyEmail).mockResolvedValue();
    const wrapper = mount(AuthView, {
      props: { link: { kind: "verify", token: "a".repeat(43) } },
    });
    expect(auth.verifyEmail).not.toHaveBeenCalled();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(auth.verifyEmail).toHaveBeenCalledWith("a".repeat(43));
    expect(wrapper.get("[role=status]").text()).toContain("bestätigt");
  });
  it("resets the password and returns to login", async () => {
    vi.mocked(auth.resetPassword).mockResolvedValue();
    const wrapper = mount(AuthView, {
      props: { link: { kind: "reset", token: "r".repeat(43) } },
    });
    await wrapper.get("[name=password]").setValue("a-new-long-password");
    await wrapper.get("[name=confirmation]").setValue("a-new-long-password");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(auth.resetPassword).toHaveBeenCalledWith(
      "r".repeat(43),
      "a-new-long-password",
    );
    expect(wrapper.text()).toContain("allen anderen Geräten");
  });
  it("shows errors without leaking the token into the UI", async () => {
    vi.mocked(auth.verifyEmail).mockRejectedValue(new Error("Link abgelaufen"));
    const token = "v".repeat(43);
    const wrapper = mount(AuthView, {
      props: { link: { kind: "verify", token } },
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("[role=alert]").text()).toBe("Link abgelaufen");
    expect(wrapper.text()).not.toContain(token);
  });
});
