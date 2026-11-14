import { useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { listStudents } from "../api/students";
import { listMaterials, uploadMaterial } from "../api/materials";
import { createHomeworkAssignment } from "../api/homework";
import type { Material, Student } from "../api/types";
import { localInputToIso } from "../lib/datetime";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { FileUp } from "lucide-react";

/** Give homework. With `studentId` it is for that student (no student picker). */
export function HomeworkAssignmentDialog({
  open,
  onClose,
  onCreated,
  studentId: fixedStudentId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  studentId?: string;
}) {
  const { token } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addNewMaterial = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const material = await uploadMaterial(token, file, file.name.replace(/\.[^.]+$/, ""), null);
      setMaterials((list) => [material, ...list]);
      setMaterialIds((ids) => [...ids, material.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити файл");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    Promise.all([listStudents(token), listMaterials(token)])
      .then(([s, m]) => {
        setStudents(s);
        setMaterials(m);
        setStudentId((current) => fixedStudentId || current || s[0]?.id || "");
      })
      .catch(() => setError("Не вдалося завантажити учнів і матеріали"));
  }, [open, token, fixedStudentId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createHomeworkAssignment(token, {
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt ? localInputToIso(dueAt) : null,
        material_ids: materialIds,
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      setMaterialIds([]);
      onCreated();
      onClose();
    } catch {
      setError("Не вдалося створити завдання");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Нове домашнє завдання</DialogTitle>
          <DialogDescription className="sr-only">
            Форма для створення нового домашнього завдання учню
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          {fixedStudentId ? null : (
            <div className="space-y-1">
              <Label htmlFor="hw-student">Учень</Label>
              <select
                id="hw-student"
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
          )}
          <div className="space-y-1">
            <Label htmlFor="hw-title">Назва *</Label>
            <Input
              id="hw-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hw-desc">Що зробити</Label>
            <Textarea
              id="hw-desc"
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hw-due">Здати до</Label>
            <Input
              id="hw-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Матеріали</Label>
            {materials.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
                {materials.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={materialIds.includes(m.id)}
                      onChange={() =>
                        setMaterialIds(
                          materialIds.includes(m.id)
                            ? materialIds.filter((x) => x !== m.id)
                            : [...materialIds, m.id]
                        )
                      }
                    />
                    {m.title}
                  </label>
                ))}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
              <FileUp className="h-4 w-4" />
              {uploading ? "Завантажую…" : "Завантажити новий файл"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.txt,.md"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  void addNewMaterial(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Новий файл потрапить і в бібліотеку «Матеріали». Учень і батьки побачать прикріплене
              разом із завданням.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={saving || uploading || !studentId || !title.trim()}>
              Задати
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
