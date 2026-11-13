import { useState } from "react";
import type { QuestionKind, Quiz, QuizIn } from "../api/types";
import { ApiError } from "../api/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface DraftQuestion {
  kind: QuestionKind;
  prompt: string;
  points: number;
  options: { text: string; correct: boolean }[];
  reference: string;
}

const KIND_LABEL: Record<QuestionKind, string> = {
  single: "Один варіант",
  multiple: "Кілька варіантів",
  text: "Письмова відповідь (перевіряє ШІ)",
};

function blank(kind: QuestionKind = "single"): DraftQuestion {
  return {
    kind,
    prompt: "",
    points: kind === "text" ? 5 : 1,
    options: [
      { text: "", correct: true },
      { text: "", correct: false },
    ],
    reference: "",
  };
}

function fromQuiz(quiz: Quiz): DraftQuestion[] {
  return quiz.questions.map((q) => ({
    kind: q.kind,
    prompt: q.prompt,
    points: q.points,
    options: (q.options ?? []).map((o) => ({
      text: o.text,
      correct: (q.correct_options ?? []).includes(o.id),
    })),
    reference: q.reference_answer ?? "",
  }));
}

function toQuizIn(title: string, description: string, questions: DraftQuestion[]): QuizIn {
  return {
    title: title.trim(),
    description: description.trim() || null,
    questions: questions.map((q) =>
      q.kind === "text"
        ? {
            kind: q.kind,
            prompt: q.prompt.trim(),
            points: q.points,
            reference_answer: q.reference.trim(),
          }
        : {
            kind: q.kind,
            prompt: q.prompt.trim(),
            points: q.points,
            options: q.options.map((o) => ({ text: o.text.trim(), correct: o.correct })),
          }
    ),
  };
}

/** The quiz form: used to create a quiz and to edit a draft or unassigned quiz. */
export function QuizEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Quiz;
  submitLabel: string;
  onSubmit: (data: QuizIn) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initial ? fromQuiz(initial) : [blank()]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(toQuizIn(title, description, questions));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422
          ? "Перевірте питання: у кожного має бути текст; для «один варіант» — рівно одна правильна відповідь, для «кілька» — хоча б одна; для письмових — еталон."
          : err instanceof ApiError && err.detail === "quiz_in_use"
            ? "Тест уже призначено учням — змінити його не можна."
            : "Не вдалося зберегти тест"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="qz-title">Назва *</Label>
        <Input
          id="qz-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="qz-desc">Опис</Label>
        <Textarea
          id="qz-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {questions.map((q, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-3 bg-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Питання {i + 1}</span>
            <select
              aria-label="Тип питання"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={q.kind}
              onChange={(e) =>
                update(i, { ...blank(e.target.value as QuestionKind), prompt: q.prompt })
              }
            >
              {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm">
              Бали
              <Input
                type="number"
                min={1}
                max={100}
                className="h-9 w-20"
                value={q.points}
                onChange={(e) => update(i, { points: Number(e.target.value) })}
              />
            </label>
            {questions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Видалити питання"
                onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Textarea
            rows={2}
            placeholder="Текст питання"
            value={q.prompt}
            onChange={(e) => update(i, { prompt: e.target.value })}
            required
          />
          {q.kind === "text" ? (
            <Textarea
              rows={2}
              placeholder="Еталонна відповідь — з нею ШІ порівнює відповідь учня"
              value={q.reference}
              onChange={(e) => update(i, { reference: e.target.value })}
              required
            />
          ) : (
            <div className="space-y-2">
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type={q.kind === "single" ? "radio" : "checkbox"}
                    name={`correct-${i}`}
                    aria-label="Правильна відповідь"
                    checked={o.correct}
                    onChange={() =>
                      update(i, {
                        options: q.options.map((x, m) => ({
                          ...x,
                          correct: q.kind === "single" ? m === k : m === k ? !x.correct : x.correct,
                        })),
                      })
                    }
                  />
                  <Input
                    className="h-9"
                    placeholder={`Варіант ${k + 1}`}
                    value={o.text}
                    onChange={(e) =>
                      update(i, {
                        options: q.options.map((x, m) =>
                          m === k ? { ...x, text: e.target.value } : x
                        ),
                      })
                    }
                    required
                  />
                  {q.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Прибрати варіант"
                      onClick={() => update(i, { options: q.options.filter((_, m) => m !== k) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {q.options.length < 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(i, { options: [...q.options, { text: "", correct: false }] })
                  }
                >
                  + варіант
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Позначте правильні відповіді.</p>
            </div>
          )}
        </div>
      ))}

      {questions.length < 50 && (
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => setQuestions([...questions, blank()])}
        >
          <Plus className="h-4 w-4" />
          Додати питання
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Скасувати
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Збереження…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
