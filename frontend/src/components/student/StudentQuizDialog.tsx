import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../auth/session";
import { assignQuiz, listQuizzes } from "../../api/quizzes";
import type { QuizSummary } from "../../api/types";
import { localInputToIso } from "../../lib/datetime";
import { QuizBuilderDialog } from "../QuizBuilderDialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Plus } from "lucide-react";

/** Assign a quiz to one student: pick an existing one or create a new one first. */
export function StudentQuizDialog({
  open,
  studentId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  studentId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { token } = useSession();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizId, setQuizId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadQuizzes = useCallback(
    async (select?: string) => {
      const ready = (await listQuizzes(token)).filter((q) => q.status === "ready");
      setQuizzes(ready);
      setQuizId((current) => select ?? (current || ready[0]?.id || ""));
    },
    [token]
  );

  useEffect(() => {
    if (open) loadQuizzes().catch(() => setError("Не вдалося завантажити тести"));
  }, [open, loadQuizzes]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await assignQuiz(token, quizId, {
        student_id: studentId,
        due_at: dueAt ? localInputToIso(dueAt) : null,
      });
      setDueAt("");
      onAssigned();
      onClose();
    } catch {
      setError("Не вдалося призначити тест");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open && !builderOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Призначити тест</DialogTitle>
            <DialogDescription className="sr-only">
              Вибір наявного тесту або створення нового для цього учня
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sq-quiz">Тест</Label>
              {quizzes.length > 0 ? (
                <select
                  id="sq-quiz"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}
                >
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} · {q.question_count} пит.
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Готових тестів ще немає. Створіть новий (чернетки від ШІ спершу треба опублікувати
                  в розділі «Тести»).
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setBuilderOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Створити новий тест
            </Button>
            <div className="space-y-1">
              <Label htmlFor="sq-due">Здати до (необов'язково)</Label>
              <Input
                id="sq-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Скасувати
              </Button>
              <Button type="submit" disabled={saving || !quizId}>
                Призначити
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <QuizBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={(quiz) => void loadQuizzes(quiz.id)}
      />
    </>
  );
}
