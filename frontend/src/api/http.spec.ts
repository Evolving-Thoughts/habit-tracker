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

describe("failure messages", () => {
  const load = async (response: Response | Error | DOMException) => {
    vi.resetModules();
    const fetchMock =
      response instanceof Response
        ? vi.fn().mockResolvedValue(response)
        : vi.fn().mockRejectedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return import("./http");
  };
  const nestError = () =>
    new Response(
      JSON.stringify({ statusCode: 500, message: "Internal server error" }),
      { status: 500 },
    );

  it("replaces Nest's bare server error on a read with plain words", async () => {
    const { request } = await load(nestError());
    await expect(request("/todos")).rejects.toThrow(
      "Der Server hatte gerade einen Fehler. Deine Daten sind davon nicht betroffen; versuch es gleich noch einmal.",
    );
  });

  it("says on a failed write that nothing was saved and the input stays", async () => {
    const { request, ApiError } = await load(nestError());
    const failure = request("/todos/1", { method: "PATCH", body: "{}" });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toThrow(
      "Der Server hatte gerade einen Fehler, die Änderung ist nicht gespeichert. Was du eingegeben hast, bleibt hier stehen; versuch es gleich noch einmal.",
    );
  });

  it("does not claim a timed-out write was lost", async () => {
    const { request } = await load(new Response("", { status: 504 }));
    await expect(request("/todos", { method: "POST" })).rejects.toThrow(
      "Der Server hat nicht rechtzeitig geantwortet. Ob die Änderung gespeichert ist, zeigt ein Neuladen",
    );
  });

  it("keeps a specific message the server sends", async () => {
    const { request } = await load(
      new Response(
        JSON.stringify({ message: "Das Ende muss nach dem Start liegen." }),
        {
          status: 400,
        },
      ),
    );
    await expect(request("/work-logs", { method: "POST" })).rejects.toThrow(
      "Das Ende muss nach dem Start liegen.",
    );
  });

  it("replaces the guard's technical refusal with plain words", async () => {
    const { request } = await load(
      new Response(
        JSON.stringify({
          message: "Ungültiger Request-Ursprung oder Content-Type.",
        }),
        { status: 403 },
      ),
    );
    const failure = request("/todos", { method: "POST" });
    await expect(failure).rejects.toThrow("Lade die Seite neu");
    await expect(failure).rejects.not.toThrow("Content-Type");
  });

  it("says how long to wait after too many requests, keeping the code", async () => {
    const { request, ApiError } = await load(
      new Response(
        JSON.stringify({
          message: "Zu viele Versuche. Bitte später erneut versuchen.",
          code: "X",
        }),
        { status: 429 },
      ),
    );
    const failure = request("/auth/login", { method: "POST" });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toThrow("in ein paar Minuten");
    await expect(failure).rejects.toMatchObject({ status: 429, code: "X" });
  });

  it("turns an unreachable server into a TypeError with our words", async () => {
    const { request, ConnectionError } = await load(
      new TypeError("Failed to fetch"),
    );
    const failure = request("/todos");
    await expect(failure).rejects.toBeInstanceOf(ConnectionError);
    await expect(failure).rejects.toBeInstanceOf(TypeError);
    await expect(failure).rejects.toThrow("Keine Verbindung zum Server.");
  });

  it("lets an abort through as it is", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const { request } = await load(abort);
    await expect(request("/todos")).rejects.toBe(abort);
  });
});
