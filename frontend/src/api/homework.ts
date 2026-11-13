import { ApiError, apiFetch } from "./client";
import type { Homework, SubmissionStatus, UploadTarget } from "./types";

// ---------- student / parent ----------

export function getLessonHomework(token: string, lessonId: string): Promise<Homework | null> {
  return apiFetch<Homework>(token, `/api/portal/lessons/${lessonId}/homework`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
}

/** Asks for a signed target, then sends the file straight to storage. */
export async function uploadPhoto(token: string, lessonId: string, file: File): Promise<string> {
  const target = await apiFetch<UploadTarget>(
    token,
    `/api/portal/lessons/${lessonId}/homework/uploads`,
    {
      method: "POST",
      body: JSON.stringify({ content_type: file.type, size_bytes: file.size }),
    }
  );
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  form.append("file", file);
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Не вдалося завантажити фото (${res.status})`);
  return target.key;
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
