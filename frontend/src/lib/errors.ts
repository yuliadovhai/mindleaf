import { ApiError } from "../api/client";

/** A sentence for the tutor instead of an exception. */
export function errorText(err: unknown, fallback = "Не вдалося зберегти"): string {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail;
  return fallback;
}
