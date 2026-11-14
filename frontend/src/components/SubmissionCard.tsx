import { useState } from "react";
import { useSession } from "../auth/session";
import { reviewHomework } from "../api/homework";
import type { Homework } from "../api/types";
import { formatDateTime } from "../lib/datetime";
import { CARD } from "../lib/labels";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

function ReviewForm({ item, onSaved }: { item: Homework; onSaved: (h: Homework) => void }) {
  const { token } = useSession();
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [grade, setGrade] = useState<string>(item.grade ? String(item.grade) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(
        await reviewHomework(token, item.id, {
          feedback: feedback.trim() || null,
          grade: grade ? Number(grade) : null,
        })
      );
    } catch {
      setError("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl bg-muted/40 p-3">
      <div className="space-y-1">
        <Label htmlFor={`fb-${item.id}`}>Відгук</Label>
        <Textarea
          id={`fb-${item.id}`}
          rows={2}
          maxLength={2000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`gr-${item.id}`}>Оцінка (1–12)</Label>
          <select
            id={`gr-${item.id}`}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">без оцінки</option>
            {Array.from({ length: 12 }, (_, i) => 12 - i).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={saving || (!feedback.trim() && !grade)} onClick={() => void save()}>
          {saving ? "Збереження…" : "Перевірено"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** A homework answer as the tutor sees it, with the review form until reviewed. */
export function SubmissionCard({
  item,
  showStudent = true,
  onReviewed,
}: {
  item: Homework;
  showStudent?: boolean;
  onReviewed: (h: Homework) => void;
}) {
  return (
    <div className={`${CARD} p-4 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {showStudent && item.student_full_name}
          {item.title && (
            <span className={showStudent ? "font-normal" : ""}>
              {showStudent ? " — " : ""}
              {item.title}
            </span>
          )}
          {!showStudent && !item.title && "ДЗ з заняття"}
        </span>
        <span className="text-sm text-muted-foreground">
          {item.lesson_starts_at
            ? `Заняття ${formatDateTime(item.lesson_starts_at)} · `
            : item.due_at
              ? `Строк ${formatDateTime(item.due_at)} · `
              : ""}
          здано {formatDateTime(item.submitted_at)}
        </span>
      </div>
      {item.task && (
        <p className="text-sm">
          <span className="text-muted-foreground">Завдання: </span>
          {item.task}
        </p>
      )}
      {item.text && <p className="whitespace-pre-wrap">{item.text}</p>}
      {item.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.photos.map((p) => (
            <a key={p.key} href={p.url} target="_blank" rel="noreferrer">
              <img
                src={p.url}
                alt="Фото відповіді"
                className="h-24 w-24 rounded-md border object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {item.status === "reviewed" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="success">
            Перевірено{item.grade !== null ? ` · ${item.grade}/12` : ""}
          </Badge>
          {item.feedback && <span className="italic">«{item.feedback}»</span>}
        </div>
      ) : (
        <ReviewForm item={item} onSaved={onReviewed} />
      )}
    </div>
  );
}
