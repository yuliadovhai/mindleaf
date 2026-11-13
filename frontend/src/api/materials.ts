import { apiFetch } from "./client";
import { uploadFile } from "./upload";
import type { Generation, Material, MaterialType, MemberMaterial } from "./types";

const BY_EXTENSION: Record<string, MaterialType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  txt: "text/plain",
  md: "text/markdown",
};

/** Browsers often send no type for .md: decide by extension. null = unsupported. */
export function materialType(file: File): MaterialType | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

export async function uploadMaterial(
  token: string,
  file: File,
  title: string,
  description: string | null
): Promise<Material> {
  const type = materialType(file);
  if (!type) throw new Error("Підтримуються PDF, JPEG, PNG, TXT і MD");
  const key = await uploadFile(token, "/api/materials/uploads", file, type);
  return apiFetch<Material>(token, "/api/materials", {
    method: "POST",
    body: JSON.stringify({
      key,
      title,
      description,
      original_name: file.name,
      size_bytes: file.size,
    }),
  });
}

export function listMaterials(token: string): Promise<Material[]> {
  return apiFetch<Material[]>(token, "/api/materials");
}

export function deleteMaterial(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/materials/${id}`, { method: "DELETE" });
}

export function setShares(token: string, id: string, studentIds: string[]): Promise<Material> {
  return apiFetch<Material>(token, `/api/materials/${id}/shares`, {
    method: "PUT",
    body: JSON.stringify({ student_ids: studentIds }),
  });
}

export function generateQuiz(
  token: string,
  materialId: string,
  data: { question_count: number; include_written: boolean; instructions: string | null }
): Promise<Generation> {
  return apiFetch<Generation>(token, `/api/materials/${materialId}/generate-quiz`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listGenerations(token: string): Promise<Generation[]> {
  return apiFetch<Generation[]>(token, "/api/quiz-generations");
}

export function listMyMaterials(token: string): Promise<MemberMaterial[]> {
  return apiFetch<MemberMaterial[]>(token, "/api/portal/materials");
}

/** "1,2 МБ" / "340 КБ" */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}
