import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { createPayment, updatePayment } from "../api/payments";
import { listStudents } from "../api/students";
import type { Payment, PaymentCreate, PaymentUpdate, PaymentMethod, Student } from "../api/types";
import { kopecksToInput, parseMoney } from "../lib/money";
import { isoToLocalInput, localInputToIso } from "../lib/datetime";
import { ApiError } from "../api/client";

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (payment: Payment) => void;
  initial?: Payment;
  defaultStudentId?: string;
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Готівка" },
  { value: "card", label: "Картка" },
  { value: "transfer", label: "Переказ" },
];

export function PaymentForm({
  open,
  onClose,
  onSaved,
  initial,
  defaultStudentId,
}: PaymentFormProps) {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(initial?.student_id ?? defaultStudentId ?? "");
  const [amountInput, setAmountInput] = useState(initial ? kopecksToInput(initial.amount) : "");
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? "cash");
  const [paidAt, setPaidAt] = useState(initial ? isoToLocalInput(initial.paid_at) : "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || initial) return;
    listStudents(token, false)
      .then((list) => {
        const all = list;
        setStudents(all);
        if (!studentId && all.length > 0) {
          setStudentId(all[0].id);
        }
      })
      .catch(() => {});
  }, [open, token, studentId, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const nullOrStr = (s: string) => s.trim() || null;
      if (initial) {
        const data: PaymentUpdate = {
          amount: parseMoney(amountInput),
          method,
          paid_at: paidAt ? localInputToIso(paidAt) : undefined,
          comment: nullOrStr(comment),
        };
        const saved = await updatePayment(token, initial.id, data);
        onSaved(saved);
      } else {
        const data: PaymentCreate = {
          student_id: studentId,
          amount: parseMoney(amountInput),
          method,
          paid_at: paidAt ? localInputToIso(paidAt) : undefined,
          comment: nullOrStr(comment),
        };
        const saved = await createPayment(token, data);
        onSaved(saved);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail;
        if (detail === "student_not_found") setError("Учня не знайдено");
        else setError(typeof detail === "string" ? detail : "Помилка збереження");
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Редагувати оплату" : "Нова оплата"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {!initial && (
            <div className="space-y-1">
              <Label htmlFor="pf-student">Учень *</Label>
              <Select value={studentId} onValueChange={setStudentId} required>
                <SelectTrigger id="pf-student">
                  <SelectValue placeholder="Оберіть учня" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                      {s.archived ? " (архів)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pf-amount">Сума (₴) *</Label>
              <Input
                id="pf-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-method">Спосіб *</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="pf-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-paid-at">Дата оплати</Label>
            <Input
              id="pf-paid-at"
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-comment">Коментар</Label>
            <Textarea
              id="pf-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
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
