/** Where the API lives: "/api" behind the same origin, or VITE_API_BASE_URL. */
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
/**
 * This app's name for the server's live updates (docs/live-sync.md): sent
 * with every request, so a change this app made comes back marked as its
 * own and does not reload it twice.
 */
export const CLIENT_ID: string =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * The server could not be reached. Still a TypeError, as fetch's own, so
 * code that tells offline apart keeps working; only the words are ours.
 */
export class ConnectionError extends TypeError {
  constructor() {
    super(
      "Keine Verbindung zum Server. Prüf die Verbindung und versuch es noch einmal.",
    );
    this.name = "ConnectionError";
  }
}

/** What NestJS says for an exception it did not expect: no cause in it. */
const GENERIC_SERVER_MESSAGE = "Internal server error";

/** Plain words for server texts that only make sense to a developer. */
const TECHNICAL_MESSAGES: Record<string, string> = {
  // The auth guard: the request did not come from this app's own page.
  "Ungültiger Request-Ursprung oder Content-Type.":
    "Die Anfrage wurde aus Sicherheitsgründen abgelehnt, weil sie nicht von dieser Seite kam. Lade die Seite neu und versuch es noch einmal.",
};

/** Plain words for too many requests in a short time (429). */
export const TOO_MANY_REQUESTS =
  "Zu viele Versuche in kurzer Zeit. Zum Schutz ist das kurz gesperrt; versuch es in ein paar Minuten noch einmal.";

/**
 * Plain words for a server failure without a message of its own: what
 * happened, whether anything is lost, and to try again. A failed read
 * changes nothing. A failed write ran in one transaction that was rolled
 * back; only a timeout (504) leaves open whether it arrived. Views keep
 * what was typed until a write succeeds.
 */
export function serverFailure(status: number, write: boolean): string {
  if (!write)
    return "Der Server hatte gerade einen Fehler. Deine Daten sind davon nicht betroffen; versuch es gleich noch einmal.";
  if (status === 504)
    return "Der Server hat nicht rechtzeitig geantwortet. Ob die Änderung gespeichert ist, zeigt ein Neuladen; was du eingegeben hast, bleibt hier stehen.";
  return "Der Server hatte gerade einen Fehler, die Änderung ist nicht gespeichert. Was du eingegeben hast, bleibt hier stehen; versuch es gleich noch einmal.";
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": CLIENT_ID,
        ...options?.headers,
      },
    });
  } catch (cause) {
    // An abort is the caller's own doing and stays one.
    if (cause instanceof TypeError) throw new ConnectionError();
    throw cause;
  }
  if (!response.ok) {
    const write = (options?.method ?? "GET").toUpperCase() !== "GET";
    let message =
      response.status >= 500
        ? serverFailure(response.status, write)
        : `Die Anfrage wurde abgelehnt (Status ${response.status}).`;
    let code: string | undefined;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "code" in body &&
        typeof body.code === "string"
      )
        code = body.code;
      if (body !== null && typeof body === "object" && "message" in body) {
        const detail = body.message;
        // Nest's generic text names no cause; the plain words above stay.
        if (typeof detail === "string") {
          if (detail !== GENERIC_SERVER_MESSAGE)
            message = TECHNICAL_MESSAGES[detail] ?? detail;
        } else if (
          Array.isArray(detail) &&
          detail.every((item) => typeof item === "string")
        )
          message = detail.join(" · ");
      }
    } catch {
      /* retain status fallback */
    }
    // Our words say how long to wait; the server's only say "later".
    if (response.status === 429) message = TOO_MANY_REQUESTS;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("auth-expired"));
    throw new ApiError(message, response.status, code);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
