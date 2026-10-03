import { ApiError, request } from "./http";
export interface User {
  id: string;
  email: string;
}
export async function getMe(): Promise<User | null> {
  try {
    return await request<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export const login = (email: string, password: string): Promise<User> =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const logout = (): Promise<void> =>
  request("/auth/logout", { method: "POST", body: "{}" });
export const register = (
  email: string,
  password: string,
): Promise<{ message: string }> =>
  request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const forgotPassword = (email: string): Promise<{ message: string }> =>
  request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const resendVerification = (
  email: string,
): Promise<{ message: string }> =>
  request("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const verifyEmail = (token: string): Promise<void> =>
  request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
export const resetPassword = (token: string, password: string): Promise<void> =>
  request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
