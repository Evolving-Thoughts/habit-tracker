import { ApiError, ConnectionError, TOO_MANY_REQUESTS } from "./http";

/** The sign-in screen's calls, each with its own plain words on failure. */
export type AuthAction =
  "login" | "register" | "forgot" | "resend" | "verify" | "reset";

/** The server's code when the password is right but the e-mail unconfirmed. */
export const EMAIL_UNVERIFIED = "EMAIL_UNVERIFIED";

/** True when a sign-in failed only because the e-mail is not confirmed yet. */
export function isEmailUnverified(cause: unknown): boolean {
  return cause instanceof ApiError && cause.code === EMAIL_UNVERIFIED;
}

const LINK_INVALID =
  "Dieser Link gilt nicht mehr: Er wurde schon benutzt oder ist abgelaufen. Fordere unten einen neuen an.";
const RETRY = "Das hat gerade nicht geklappt. Versuch es noch einmal.";

/**
 * Everyday words for a failed sign-in call: what went wrong and what one
 * can do. Never the server's own text, which may be technical; every
 * status the auth calls answer with has its own sentence here.
 */
export function authErrorMessage(cause: unknown, action: AuthAction): string {
  if (cause instanceof ConnectionError) return cause.message;
  if (!(cause instanceof ApiError)) return RETRY;
  const { status } = cause;
  if (status === 429) return TOO_MANY_REQUESTS;
  if (status === 401 && action === "login")
    return isEmailUnverified(cause)
      ? "Deine E-Mail-Adresse ist noch nicht bestätigt. Öffne den Link aus unserer E-Mail oder lass ihn dir unten noch einmal schicken."
      : "E-Mail-Adresse oder Passwort stimmt nicht. Prüf beides, oder leg über „Passwort vergessen?“ ein neues Passwort fest.";
  if (status === 403)
    return "Die Anfrage wurde aus Sicherheitsgründen abgelehnt, weil sie nicht von dieser Seite kam. Lade die Seite neu und versuch es noch einmal.";
  if (status === 400)
    return action === "verify" || action === "reset"
      ? LINK_INVALID
      : "Das sieht nicht nach einer gültigen Eingabe aus. Prüf die E-Mail-Adresse (etwa name@beispiel.de) und, falls gefragt, das Passwort: 12 bis 128 Zeichen.";
  if (status === 409)
    return "Das hat sich mit einer anderen Anfrage überschnitten. Lade die Seite neu und versuch es noch einmal.";
  if (status === 503 && action === "register")
    return "Wir können gerade keine E-Mails verschicken, deshalb ist das Konto noch nicht angelegt. Versuch es später noch einmal.";
  if (status === 503)
    return "Wir können gerade keine E-Mails verschicken. Versuch es später noch einmal.";
  if (status >= 500)
    return "Der Server hatte gerade einen Fehler. Es ist nichts verloren; versuch es in einem Moment noch einmal.";
  return RETRY;
}
