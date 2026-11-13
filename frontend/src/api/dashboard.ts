import { apiFetch } from "./client";
import type { Dashboard } from "./types";

export function getDashboard(token: string): Promise<Dashboard> {
  return apiFetch<Dashboard>(token, "/api/dashboard");
}
