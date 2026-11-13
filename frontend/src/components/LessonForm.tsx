import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { createLesson, updateLesson } from "../api/lessons";
import { listStudents } from "../api/students";
import type { Lesson, LessonCreate, LessonUpdate, LessonStatus, Student } from "../api/types";
import { kopecksToInput, parseMoney } from "../lib/money";
import { isoToLocalInput, localInputToIso } from "../lib/datetime";
import { ApiError } from "../api/client";

interface LessonFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (lesson: Lesson) => void;
  initial?: Lesson;
  defaultStudentId?: string;
}

const STATUS_OPTIONS: { value: LessonStatus; label: string }[] = [
  { value: "planned", label: "Заплановано" },
  { value: "done", label: "Проведено" },
  { value: "cancelled", label: "Скасовано" },
  { value: "missed", label: "Пропуск" },
];

export function LessonForm({ open, onClose, onSaved, initial, defaultStudentId }: LessonFormProps) {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(initial?.student_id ?? defaultStudentId ?? "");
  const [startsAt, setStartsAt] = useState(initial ? isoToLocalInput(initial.starts_at) : "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? 60));
  const [priceInput, setPriceInput] = useState(initial ? kopecksToInput(initial.price) : "");
  const [status, setStatus] = useState<LessonStatus>(initial?.status ?? "planned");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [homework, setHomework] = useState(initial?.homework ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    listStudents(token, false)
      .then((list) => {
        setStudents(list);
        if (!studentId && list.length > 0) {
          setStudentId(list[0].id);
        }
      })
      .catch(() => {});
  }, [open, token, studentId]);

  useEffect(() => {
    if (!studentId || initial || priceInput) return;
    const student = students.find((s) => s.id === studentId);
    if (student) {
      setPriceInput(kopecksToInput(student.default_price));
    }
  }, [studentId, students, initial, priceInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const nullOrStr = (s: string) => s.trim() || null;
      if (initial) {
        const data: LessonUpdate = {
          starts_at: localInputToIso(startsAt),
          duration_minutes: parseInt(duration, 10),
          price: parseMoney(priceInput),
          topic: nullOrStr(topic),
          homework: nullOrStr(homework),
          notes: nullOrStr(notes),
        };
        const saved = await updateLesson(token, initial.id, data);
        onSaved(saved);
      } else {
        const data: LessonCreate = {
          student_id: studentId,
          starts_at: localInputToIso(startsAt),
          duration_minutes: parseInt(duration, 10),
          price: parseMoney(priceInput),
          status,
          topic: nullOrStr(topic),
          homework: nullOrStr(homework),
          notes: nullOrStr(notes),
        };
        const saved = await createLesson(token, data);
        onSaved(saved);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail;
        if (detail === "student_not_found") setError("Учня не знайдено");
        else if (detail === "student_archived") setError("Учень архівований");
        else setError(typeof detail === "string" ? detail : "Помилка збереження");
      } else {
        setError("Помилка збереження");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Редагувати заняття" : "Нове заняття"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {!initial && (
            <div className="space-y-1">
              <Label htmlFor="lf-student">Учень *</Label>
              <Select value={studentId} onValueChange={setStudentId} required>
                <SelectTrigger id="lf-student">
                  <SelectValue placeholder="Оберіть учня" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="lf-starts-at">Початок *</Label>
            <Input
              id="lf-starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lf-duration">Тривалість (хв) *</Label>
              <Input
                id="lf-duration"
                type="number"
                min="1"
                max="720"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lf-price">Ціна (₴) *</Label>
              <Input
                id="lf-price"
                type="number"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                required
              />
            </div>
          </div>
          {!initial && (
            <div className="space-y-1">
              <Label htmlFor="lf-status">Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
                <SelectTrigger id="lf-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="lf-topic">Тема</Label>
            <Input
              id="lf-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lf-homework">Домашнє завдання</Label>
            <Textarea
              id="lf-homework"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lf-notes">Нотатки</Label>
            <Textarea
              id="lf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Збереження…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
