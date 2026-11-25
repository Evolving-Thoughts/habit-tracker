import { describe, expect, it } from "vitest";
import { authErrorMessage, isEmailUnverified } from "./auth-errors";
import { ApiError, ConnectionError, TOO_MANY_REQUESTS } from "./http";

const api = (status: number, code?: string) =>
  new ApiError("Ungültiger Request-Ursprung oder Content-Type.", status, code);

describe("authErrorMessage", () => {
  it("never passes the server's own text through", () => {
    for (const status of [400, 401, 403, 409, 429, 500, 503, 504, 418])
      for (const action of ["login", "register", "verify"] as const)
        expect(authErrorMessage(api(status), action)).not.toContain(
          "Request-Ursprung",
        );
  });

  it("tells an unconfirmed e-mail from a wrong password", () => {
    const unverified = api(401, "EMAIL_UNVERIFIED");
    expect(isEmailUnverified(unverified)).toBe(true);
    expect(isEmailUnverified(api(401))).toBe(false);
    expect(authErrorMessage(unverified, "login")).toContain(
      "noch nicht bestätigt",
    );
    expect(authErrorMessage(api(401), "login")).toContain(
      "Passwort stimmt nicht",
    );
  });

  it("says how long to wait after too many attempts", () => {
    expect(authErrorMessage(api(429), "login")).toBe(TOO_MANY_REQUESTS);
    expect(TOO_MANY_REQUESTS).toContain("in ein paar Minuten");
  });

  it("names a used or expired link and what to do", () => {
    expect(authErrorMessage(api(400), "verify")).toContain("neuen an");
    expect(authErrorMessage(api(400), "reset")).toContain("neuen an");
    expect(authErrorMessage(api(400), "login")).toContain("E-Mail-Adresse");
  });

  it("says when mail cannot go out and the account is not created", () => {
    expect(authErrorMessage(api(503), "register")).toContain(
      "noch nicht angelegt",
    );
    expect(authErrorMessage(api(503), "resend")).toContain("E-Mails");
  });

  it("uses plain words for a security refusal, a clash and server errors", () => {
    expect(authErrorMessage(api(403), "login")).toContain("Lade die Seite neu");
    expect(authErrorMessage(api(409), "register")).toContain("noch einmal");
    expect(authErrorMessage(api(500), "login")).toContain("nichts verloren");
  });

  it("keeps the offline words and replaces anything unknown", () => {
    const offline = new ConnectionError();
    expect(authErrorMessage(offline, "login")).toBe(offline.message);
    expect(authErrorMessage(new Error("boom"), "login")).toBe(
      "Das hat gerade nicht geklappt. Versuch es noch einmal.",
    );
  });
});
