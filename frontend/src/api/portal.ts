import { apiFetch } from "./client";
import type { PortalLesson, PortalPayment, PortalStudent } from "./types";

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listMyStudents(token: string): Promise<PortalStudent[]> {
  return apiFetch<PortalStudent[]>(token, "/api/portal/students");
}

export function listMyLessons(
  token: string,
  params: { from?: string; to?: string; student_id?: string } = {}
): Promise<PortalLesson[]> {
  return apiFetch<PortalLesson[]>(token, `/api/portal/lessons${query(params)}`);
}

export function getMyLesson(token: string, id: string): Promise<PortalLesson> {
  return apiFetch<PortalLesson>(token, `/api/portal/lessons/${id}`);
}

export function cancelLesson(token: string, id: string): Promise<PortalLesson> {
  return apiFetch<PortalLesson>(token, `/api/portal/lessons/${id}/cancel`, { method: "POST" });
}

export function listMyPayments(
  token: string,
  params: { student_id?: string } = {}
): Promise<PortalPayment[]> {
  return apiFetch<PortalPayment[]>(token, `/api/portal/payments${query(params)}`);
}
