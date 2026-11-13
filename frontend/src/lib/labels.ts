import type { AssignmentStatus, Role } from "../api/types";

export const ROLE_LABEL: Record<Role, string> = {
  tutor: "Репетитор",
  student: "Учень",
  parent: "Батьки",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Треба пройти",
  submitted: "Перевіряє ШІ",
  needs_review: "Перевіряє репетитор",
  graded: "Оцінено",
};

export const METHOD_LABEL = { cash: "Готівка", card: "Картка", transfer: "Переказ" } as const;

/** "дуже довгий текст" → "дуже довгий т…" */
export function shorten(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
