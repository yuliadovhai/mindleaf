import { apiFetch } from "./client";
import type {
  AnswerIn,
  Assignment,
  AssignmentDetail,
  AssignmentStatus,
  Quiz,
  QuizIn,
  QuizSummary,
} from "./types";

// ---------- tutor ----------

export function listQuizzes(token: string): Promise<QuizSummary[]> {
  return apiFetch<QuizSummary[]>(token, "/api/quizzes");
}

export function getQuiz(token: string, id: string): Promise<Quiz> {
  return apiFetch<Quiz>(token, `/api/quizzes/${id}`);
}

export function createQuiz(token: string, data: QuizIn): Promise<Quiz> {
  return apiFetch<Quiz>(token, "/api/quizzes", { method: "POST", body: JSON.stringify(data) });
}

export function replaceQuiz(token: string, id: string, data: QuizIn): Promise<Quiz> {
  return apiFetch<Quiz>(token, `/api/quizzes/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function publishQuiz(token: string, id: string): Promise<Quiz> {
  return apiFetch<Quiz>(token, `/api/quizzes/${id}/publish`, { method: "POST" });
}

export function deleteQuiz(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/quizzes/${id}`, { method: "DELETE" });
}

export function assignQuiz(
  token: string,
  quizId: string,
  data: { student_id: string; due_at?: string | null }
): Promise<Assignment> {
  return apiFetch<Assignment>(token, `/api/quizzes/${quizId}/assignments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listAssignments(token: string, status?: AssignmentStatus): Promise<Assignment[]> {
  return apiFetch<Assignment[]>(token, `/api/quiz-assignments${status ? `?status=${status}` : ""}`);
}

export function getAssignment(token: string, id: string): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(token, `/api/quiz-assignments/${id}`);
}

export function gradeAnswer(
  token: string,
  assignmentId: string,
  questionId: string,
  data: { points: number; feedback: string | null }
): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(
    token,
    `/api/quiz-assignments/${assignmentId}/answers/${questionId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ---------- student / parent ----------

export function listMyAssignments(token: string): Promise<Assignment[]> {
  return apiFetch<Assignment[]>(token, "/api/portal/quiz-assignments");
}

export function getMyAssignment(token: string, id: string): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(token, `/api/portal/quiz-assignments/${id}`);
}

export function submitAssignment(
  token: string,
  id: string,
  answers: AnswerIn[]
): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(token, `/api/portal/quiz-assignments/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}
