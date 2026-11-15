import { useState } from "react";
import { useSession } from "../auth/session";
import { reviewHomework } from "../api/homework";
import type { Homework } from "../api/types";
import { formatDateTime } from "../lib/datetime";
import { CARD } from "../lib/labels";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Check } from "lucide-react";

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
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Відгук учню"
          placeholder="Відгук учню (необов'язково)"
          maxLength={2000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <select
            aria-label="Оцінка"
            className="h-10 flex-1 rounded-full border border-input bg-background px-3 text-sm sm:flex-none"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">Оцінка</option>
            {Array.from({ length: 12 }, (_, i) => 12 - i).map((g) => (
              <option key={g} value={g}>
                {g} з 12
              </option>
            ))}
          </select>
          <Button
            className="flex-1 gap-1.5 sm:flex-none"
            disabled={saving || (!feedback.trim() && !grade)}
            onClick={() => void save()}
          >
            <Check className="h-4 w-4" />
            {saving ? "Збереження…" : "Перевірено"}
          </Button>
        </div>
      </div>
      {!feedback.trim() && !grade && (
        <p className="text-xs text-muted-foreground">Поставте оцінку або напишіть відгук.</p>
      )}
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
                className="h-24 w-24 rounded-xl border object-cover"
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
