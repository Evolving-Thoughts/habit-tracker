const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
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
      headers: { "Content-Type": "application/json", ...options?.headers },
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
          if (detail !== GENERIC_SERVER_MESSAGE) message = detail;
        } else if (
          Array.isArray(detail) &&
          detail.every((item) => typeof item === "string")
        )
          message = detail.join(" · ");
      }
    } catch {
      /* retain status fallback */
    }
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("auth-expired"));
    throw new ApiError(message, response.status, code);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
