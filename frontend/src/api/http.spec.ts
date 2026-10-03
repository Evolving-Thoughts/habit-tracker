import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("API origin", () => {
  it.each([
    [undefined, "/api/auth/me"],
    ["/api", "/api/auth/me"],
    ["http://localhost:3000/", "http://localhost:3000/auth/me"],
  ])("uses configured base %s with session credentials", async (base, url) => {
    vi.stubEnv("VITE_API_BASE_URL", base);
    vi.resetModules();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "test" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { request } = await import("./http");
    await request("/auth/me");
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
