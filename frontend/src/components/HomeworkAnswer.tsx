import { useState } from "react";
import type { Homework } from "../api/types";
import { ApiError } from "../api/client";
import { formatDateTime } from "../lib/datetime";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ImagePlus, X } from "lucide-react";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/heic"];

const SUBMIT_ERRORS: Record<string, string> = {
  already_reviewed: "Репетитор уже перевірив — змінити відповідь не можна.",
  no_homework: "Тут немає домашнього завдання.",
  bad_photo_key: "Фото не належить цьому завданню. Завантажте ще раз.",
};

/** The answer to any homework: what was submitted and, for a student, the form. */
export function HomeworkAnswer({
  answer,
  canSubmit,
  upload,
  submit,
  onSaved,
}: {
  answer: Homework | null;
  canSubmit: boolean;
  upload: (file: File) => Promise<string>;
  submit: (data: { text: string | null; photo_keys: string[] }) => Promise<Homework>;
  onSaved: (answer: Homework) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [keptKeys, setKeptKeys] = useState<string[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentText = text ?? answer?.text ?? "";
  const currentKeys = keptKeys ?? answer?.photos.map((p) => p.key) ?? [];
  const photoCount = currentKeys.length + files.length;
  const open = canSubmit && answer?.status !== "reviewed";

  const addFiles = (list: FileList | null) => {
    setError("");
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      setError(`«${bad.name}»: лише JPEG, PNG або HEIC до 10 МБ.`);
      return;
    }
    setFiles([...files, ...picked].slice(0, MAX_PHOTOS - currentKeys.length));
  };

  const send = async () => {
    setSaving(true);
    setError("");
    try {
      const newKeys: string[] = [];
      for (const file of files) newKeys.push(await upload(file));
      onSaved(
        await submit({ text: currentText.trim() || null, photo_keys: [...currentKeys, ...newKeys] })
      );
      setText(null);
      setKeptKeys(null);
      setFiles([]);
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setError(SUBMIT_ERRORS[detail] ?? (e instanceof Error ? e.message : "Не вдалося здати"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {answer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Відповідь
              {answer.status === "submitted" ? (
                <Badge variant="secondary">Чекає на перевірку</Badge>
              ) : (
                <Badge variant="success">Перевірено</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Здано {formatDateTime(answer.submitted_at)}
            </p>
            {answer.text && <p className="whitespace-pre-wrap">{answer.text}</p>}
            {answer.photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {answer.photos.map((p) => (
                  <a key={p.key} href={p.url} target="_blank" rel="noreferrer">
                    <img
                      src={p.url}
                      alt="Фото відповіді"
                      className="h-28 w-28 rounded-md border object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            {answer.status === "reviewed" && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                {answer.grade !== null && (
                  <p className="font-semibold">Оцінка: {answer.grade} / 12</p>
                )}
                {answer.feedback && <p className="text-sm">{answer.feedback}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!answer && !canSubmit && (
        <p className="text-sm text-muted-foreground">Відповідь ще не здана.</p>
      )}

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {answer ? "Змінити відповідь" : "Здати домашнє завдання"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="hw-text">Текст відповіді</Label>
              <Textarea
                id="hw-text"
                rows={5}
                maxLength={5000}
                value={currentText}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Фото ({photoCount}/{MAX_PHOTOS})
              </Label>
              <div className="flex flex-wrap gap-2">
                {currentKeys.map((key) => (
                  <span
                    key={key}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                  >
                    Завантажене фото
                    <button
                      aria-label="Прибрати"
                      onClick={() => setKeptKeys(currentKeys.filter((k) => k !== key))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs"
                  >
                    {f.name}
                    <button
                      aria-label="Прибрати"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {photoCount < MAX_PHOTOS && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                  <ImagePlus className="h-4 w-4" />
                  Додати фото
                  <input
                    type="file"
                    accept={TYPES.join(",")}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              disabled={saving || (!currentText.trim() && photoCount === 0)}
              onClick={() => void send()}
            >
              {saving ? "Надсилаю…" : answer ? "Оновити відповідь" : "Здати"}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
