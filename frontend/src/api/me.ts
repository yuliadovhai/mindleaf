import { apiFetch } from "./client";
import type { Tutor } from "./types";

export function getMe(token: string): Promise<Tutor> {
  return apiFetch<Tutor>(token, "/api/me");
}
