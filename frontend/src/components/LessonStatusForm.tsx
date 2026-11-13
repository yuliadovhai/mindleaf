import { useState } from "react";
import { useSession } from "../auth/session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { updateLessonStatus } from "../api/lessons";
import type { Lesson, LessonStatus } from "../api/types";
import { ApiError } from "../api/client";

interface LessonStatusFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (lesson: Lesson) => void;
  lesson: Lesson;
}

const STATUS_OPTIONS: { value: LessonStatus; label: string }[] = [
  { value: "planned", label: "Заплановано" },
  { value: "done", label: "Проведено" },
  { value: "cancelled", label: "Скасовано" },
  { value: "missed", label: "Пропуск" },
];

export function LessonStatusForm({ open, onClose, onSaved, lesson }: LessonStatusFormProps) {
  const { token } = useSession();
  const [status, setStatus] = useState<LessonStatus>(lesson.status);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await updateLessonStatus(token, lesson.id, { status });
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === "string" ? err.detail : "Помилка збереження");
      } else {
        setError("Помилка збереження");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Змінити статус заняття</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="lsf-status">Новий статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
              <SelectTrigger id="lsf-status">
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
