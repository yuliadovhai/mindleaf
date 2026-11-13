import { useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { listStudents } from "../api/students";
import { assignQuiz } from "../api/quizzes";
import type { Assignment, QuizSummary, Student } from "../api/types";
import { localInputToIso } from "../lib/datetime";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function AssignQuizDialog({
  quiz,
  onClose,
  onAssigned,
}: {
  quiz: QuizSummary | null;
  onClose: () => void;
  onAssigned: (a: Assignment) => void;
}) {
  const { token } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quiz) return;
    listStudents(token)
      .then((list) => {
        setStudents(list);
        setStudentId((current) => current || list[0]?.id || "");
      })
      .catch(() => setError("Не вдалося завантажити учнів"));
  }, [quiz, token]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz) return;
    setSaving(true);
    setError("");
    try {
      onAssigned(
        await assignQuiz(token, quiz.id, {
          student_id: studentId,
          due_at: dueAt ? localInputToIso(dueAt) : null,
        })
      );
      setDueAt("");
      onClose();
    } catch {
      setError("Не вдалося призначити тест");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={quiz !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Призначити «{quiz?.title}»</DialogTitle>
          <DialogDescription className="sr-only">
            Форма для призначення тесту учню
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="as-student">Учень</Label>
            <select
              id="as-student"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="as-due">Здати до (необов'язково)</Label>
            <Input
              id="as-due"
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
            <Button type="submit" disabled={saving || !studentId}>
              Призначити
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
