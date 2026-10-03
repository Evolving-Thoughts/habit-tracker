const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body !== null && typeof body === "object" && "message" in body) {
        const detail = body.message;
        if (typeof detail === "string") message = detail;
        else if (
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
    throw new ApiError(message, response.status);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
