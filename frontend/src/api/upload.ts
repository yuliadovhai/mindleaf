import { apiFetch } from "./client";
import type { UploadTarget } from "./types";

/** Asks the API for a signed target, then sends the file straight to storage.
 *  Returns the storage key to pass on (photo_keys, or a material's key). */
export async function uploadFile(
  token: string,
  targetPath: string,
  file: File,
  contentType: string = file.type
): Promise<string> {
  const target = await apiFetch<UploadTarget>(token, targetPath, {
    method: "POST",
    body: JSON.stringify({ content_type: contentType, size_bytes: file.size }),
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  form.append("file", new File([file], file.name, { type: contentType }));
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Не вдалося завантажити файл (${res.status})`);
  return target.key;
}
