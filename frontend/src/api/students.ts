import { apiFetch } from "./client";
import type { Student, StudentCreate, StudentUpdate } from "./types";

export function listStudents(token: string, archived = false): Promise<Student[]> {
  return apiFetch<Student[]>(token, `/api/students?archived=${archived}`);
}

export function getStudent(token: string, id: string): Promise<Student> {
  return apiFetch<Student>(token, `/api/students/${id}`);
}

export function createStudent(token: string, data: StudentCreate): Promise<Student> {
  return apiFetch<Student>(token, "/api/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateStudent(token: string, id: string, data: StudentUpdate): Promise<Student> {
  return apiFetch<Student>(token, `/api/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function archiveStudent(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/students/${id}`, { method: "DELETE" });
}
