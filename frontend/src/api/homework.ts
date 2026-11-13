import { ApiError, apiFetch } from "./client";
import { uploadFile } from "./upload";
import type {
  Homework,
  HomeworkAssignment,
  HomeworkAssignmentDetail,
  HomeworkAssignmentIn,
  SubmissionStatus,
} from "./types";

// ---------- student / parent ----------

export function getLessonHomework(token: string, lessonId: string): Promise<Homework | null> {
  return apiFetch<Homework>(token, `/api/portal/lessons/${lessonId}/homework`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
}

export function uploadPhoto(token: string, lessonId: string, file: File): Promise<string> {
  return uploadFile(token, `/api/portal/lessons/${lessonId}/homework/uploads`, file);
}

export function submitHomework(
  token: string,
  lessonId: string,
  data: { text: string | null; photo_keys: string[] }
): Promise<Homework> {
  return apiFetch<Homework>(token, `/api/portal/lessons/${lessonId}/homework`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---------- tutor ----------

export function listHomework(token: string, status?: SubmissionStatus): Promise<Homework[]> {
  return apiFetch<Homework[]>(token, `/api/homework${status ? `?status=${status}` : ""}`);
}

export function reviewHomework(
  token: string,
  id: string,
  data: { feedback: string | null; grade: number | null }
): Promise<Homework> {
  return apiFetch<Homework>(token, `/api/homework/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ---------- homework assignments: tutor ----------

export function createHomeworkAssignment(
  token: string,
  data: HomeworkAssignmentIn
): Promise<HomeworkAssignmentDetail> {
  return apiFetch<HomeworkAssignmentDetail>(token, "/api/homework-assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listHomeworkAssignments(token: string): Promise<HomeworkAssignment[]> {
  return apiFetch<HomeworkAssignment[]>(token, "/api/homework-assignments");
}

export function deleteHomeworkAssignment(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/homework-assignments/${id}`, { method: "DELETE" });
}

// ---------- homework assignments: student / parent ----------

export function listMyHomeworkAssignments(token: string): Promise<HomeworkAssignment[]> {
  return apiFetch<HomeworkAssignment[]>(token, "/api/portal/homework-assignments");
}

export function getMyHomeworkAssignment(
  token: string,
  id: string
): Promise<HomeworkAssignmentDetail> {
  return apiFetch<HomeworkAssignmentDetail>(token, `/api/portal/homework-assignments/${id}`);
}

export function uploadAssignmentPhoto(token: string, id: string, file: File): Promise<string> {
  return uploadFile(token, `/api/portal/homework-assignments/${id}/uploads`, file);
}

export function submitAssignment(
  token: string,
  id: string,
  data: { text: string | null; photo_keys: string[] }
): Promise<Homework> {
  return apiFetch<Homework>(token, `/api/portal/homework-assignments/${id}/submission`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
