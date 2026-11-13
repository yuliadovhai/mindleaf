import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { createStudent, updateStudent } from "../api/students";
import type { Student, StudentCreate, StudentUpdate } from "../api/types";
import { kopecksToInput, parseMoney } from "../lib/money";
import { ApiError } from "../api/client";

interface StudentFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (student: Student) => void;
  initial?: Student;
}

export function StudentForm({ open, onClose, onSaved, initial }: StudentFormProps) {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [telegram, setTelegram] = useState(initial?.telegram ?? "");
  const [parentName, setParentName] = useState(initial?.parent_name ?? "");
  const [parentPhone, setParentPhone] = useState(initial?.parent_phone ?? "");
  const [defaultPriceInput, setDefaultPriceInput] = useState(
    initial ? kopecksToInput(initial.default_price) : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const price = parseMoney(defaultPriceInput);
      if (!fullName.trim()) {
        setError("Ім'я учня обов'язкове");
        return;
      }
      const nullOrStr = (s: string) => s.trim() || null;
      if (initial) {
        const data: StudentUpdate = {
          full_name: fullName.trim(),
          default_price: price,
          phone: nullOrStr(phone),
          telegram: nullOrStr(telegram),
          parent_name: nullOrStr(parentName),
          parent_phone: nullOrStr(parentPhone),
          subject: nullOrStr(subject),
          notes: nullOrStr(notes),
        };
        const saved = await updateStudent(token, initial.id, data);
        onSaved(saved);
      } else {
        const data: StudentCreate = {
          full_name: fullName.trim(),
          default_price: price,
          phone: nullOrStr(phone),
          telegram: nullOrStr(telegram),
          parent_name: nullOrStr(parentName),
          parent_phone: nullOrStr(parentPhone),
          subject: nullOrStr(subject),
          notes: nullOrStr(notes),
        };
        const saved = await createStudent(token, data);
        onSaved(saved);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === "string" ? err.detail : "Помилка збереження");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Помилка збереження");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Редагувати учня" : "Новий учень"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sf-full-name">Ім'я та прізвище *</Label>
            <Input
              id="sf-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sf-subject">Предмет</Label>
              <Input
                id="sf-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sf-price">Ціна за заняття (₴) *</Label>
              <Input
                id="sf-price"
                type="number"
                min="0"
                step="0.01"
                value={defaultPriceInput}
                onChange={(e) => setDefaultPriceInput(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sf-phone">Телефон</Label>
              <Input
                id="sf-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sf-telegram">Telegram</Label>
              <Input
                id="sf-telegram"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                maxLength={64}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sf-parent-name">Батько/мати</Label>
              <Input
                id="sf-parent-name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sf-parent-phone">Телефон батьків</Label>
              <Input
                id="sf-parent-phone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                maxLength={32}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sf-notes">Нотатки</Label>
            <Textarea
              id="sf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
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
