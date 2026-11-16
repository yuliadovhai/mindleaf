import { useEffect, useMemo, useState } from "react";
import type { Homework } from "../api/types";
import { ApiError } from "../api/client";
import { formatWhenInline } from "../lib/datetime";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CheckCircle2, ImagePlus, MessageSquareQuote, Pencil, X } from "lucide-react";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/heic"];

const SUBMIT_ERRORS: Record<string, string> = {
  already_reviewed: "Репетитор уже перевірив — змінити відповідь не можна.",
  no_homework: "Тут немає домашнього завдання.",
  bad_photo_key: "Фото не належить цьому завданню. Завантажте ще раз.",
};

/** 1–12 scale: red below 4, amber below 7, green from 7 (the Ukrainian school bands). */
function gradeTone(grade: number): string {
  if (grade < 4) return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (grade < 7) return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
}

/** The answer to any homework (student and parent portal): what was handed in and the form. */
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
  const [editing, setEditing] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [dragging, setDragging] = useState(false);

  const currentText = text ?? answer?.text ?? "";
  const currentKeys = keptKeys ?? answer?.photos.map((p) => p.key) ?? [];
  const photoCount = currentKeys.length + files.length;
  const canChange = canSubmit && answer?.status !== "reviewed";
  // A first answer shows the form right away; a handed-in one hides it behind "Змінити".
  const showForm = canChange && (!answer || editing);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const photoUrl = (key: string) => answer?.photos.find((p) => p.key === key)?.url;

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
      setEditing(false);
      setJustSent(true);
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setError(SUBMIT_ERRORS[detail] ?? (e instanceof Error ? e.message : "Не вдалося здати"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {justSent && answer && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Відповідь надіслано — репетитор побачить її у своєму кабінеті.
        </div>
      )}

      {answer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Ваша відповідь
              {answer.status === "submitted" ? (
                <Badge variant="secondary">Чекає на перевірку</Badge>
              ) : (
                <Badge variant="success">Перевірено</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Здано {formatWhenInline(answer.submitted_at)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {answer.status === "reviewed" && (answer.grade !== null || answer.feedback) && (
              <div className="flex items-start gap-4 rounded-2xl bg-muted/50 p-4">
                {answer.grade !== null && (
                  <div
                    className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${gradeTone(answer.grade)}`}
                  >
                    <span className="text-2xl font-bold leading-none">{answer.grade}</span>
                    <span className="text-[11px] opacity-80">з 12</span>
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">Оцінка репетитора</p>
                  {answer.feedback ? (
                    <p className="flex gap-1.5 text-sm text-muted-foreground">
                      <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="whitespace-pre-wrap">{answer.feedback}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Без коментаря.</p>
                  )}
                </div>
              </div>
            )}
            {answer.text && <p className="whitespace-pre-wrap">{answer.text}</p>}
            {answer.photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {answer.photos.map((p) => (
                  <a key={p.key} href={p.url} target="_blank" rel="noreferrer">
                    <img
                      src={p.url}
                      alt="Фото відповіді"
                      className="h-28 w-28 rounded-xl border object-cover transition-transform hover:scale-[1.03]"
                    />
                  </a>
                ))}
              </div>
            )}
            {canChange && !editing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditing(true);
                  setJustSent(false);
                }}
              >
                <Pencil className="h-4 w-4" />
                Змінити відповідь
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!answer && !canSubmit && (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Відповідь ще не здана.
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {answer ? "Змінити відповідь" : "Здати домашнє завдання"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Напишіть відповідь або сфотографуйте розв'язок у зошиті — можна і те, і те.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="hw-text">Текст відповіді</Label>
              <Textarea
                id="hw-text"
                rows={5}
                maxLength={5000}
                placeholder="Наприклад: Вправа 10: x = 4…"
                value={currentText}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Фото{" "}
                <span className="font-normal text-muted-foreground">
                  ({photoCount} з {MAX_PHOTOS})
                </span>
              </Label>
              {photoCount > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentKeys.map((key) => (
                    <Thumb
                      key={key}
                      src={photoUrl(key)}
                      onRemove={() => setKeptKeys(currentKeys.filter((k) => k !== key))}
                    />
                  ))}
                  {files.map((f, i) => (
                    <Thumb
                      key={`${f.name}-${i}`}
                      src={previews[i]}
                      fresh
                      onRemove={() => setFiles(files.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}
              {photoCount < MAX_PHOTOS && (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    dragging
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50 hover:bg-accent/40"
                  }`}
                >
                  <ImagePlus className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Додати фото</span>
                  <span className="text-xs text-muted-foreground">
                    Перетягніть сюди або оберіть · JPEG, PNG, HEIC до 10 МБ
                  </span>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={saving || (!currentText.trim() && photoCount === 0)}
                onClick={() => void send()}
              >
                {saving ? "Надсилаю…" : answer ? "Зберегти зміни" : "Здати"}
              </Button>
              {answer && (
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setText(null);
                    setKeptKeys(null);
                    setFiles([]);
                    setError("");
                  }}
                >
                  Скасувати
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Thumb({ src, fresh, onRemove }: { src?: string; fresh?: boolean; onRemove: () => void }) {
  return (
    <span className="relative">
      {src ? (
        <img
          src={src}
          alt=""
          className={`h-20 w-20 rounded-xl border object-cover ${fresh ? "border-primary/50" : ""}`}
        />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
          Фото
        </span>
      )}
      <button
        aria-label="Прибрати фото"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
