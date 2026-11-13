import { apiFetch } from "./client";
import type { Lesson, LessonCreate, LessonUpdate, LessonStatusUpdate, LessonStatus } from "./types";

export interface LessonFilters {
  from?: string;
  to?: string;
  student_id?: string;
  status?: LessonStatus;
}

export function listLessons(token: string, filters: LessonFilters = {}): Promise<Lesson[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.student_id) params.set("student_id", filters.student_id);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch<Lesson[]>(token, `/api/lessons${qs ? `?${qs}` : ""}`);
}

export function getLesson(token: string, id: string): Promise<Lesson> {
  return apiFetch<Lesson>(token, `/api/lessons/${id}`);
}

export function createLesson(token: string, data: LessonCreate): Promise<Lesson> {
  return apiFetch<Lesson>(token, "/api/lessons", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLesson(token: string, id: string, data: LessonUpdate): Promise<Lesson> {
  return apiFetch<Lesson>(token, `/api/lessons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateLessonStatus(
  token: string,
  id: string,
  data: LessonStatusUpdate
): Promise<Lesson> {
  return apiFetch<Lesson>(token, `/api/lessons/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteLesson(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/lessons/${id}`, { method: "DELETE" });
}
