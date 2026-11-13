import { useState, useEffect, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import { listPayments, deletePayment } from "../api/payments";
import { listStudents } from "../api/students";
import type { Payment, Student } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { PaymentForm } from "../components/PaymentForm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatMoney } from "../lib/money";
import { formatDateTime, localInputToIso, todayKyiv, addDays } from "../lib/datetime";
import { useRouter } from "../lib/router";
import { Plus, Pencil, Trash2 } from "lucide-react";

const METHOD_LABEL = { cash: "Готівка", card: "Картка", transfer: "Переказ" } as const;

export function PaymentsPage() {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";
  const { navigate } = useRouter();

  const today = todayKyiv();
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState("");
  const [studentId, setStudentId] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | undefined>();

  useEffect(() => {
    listStudents(token, false)
      .then(setStudents)
      .catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const filters: { student_id?: string; from?: string; to?: string } = {};
    if (studentId !== "all") filters.student_id = studentId;
    if (from) filters.from = localInputToIso(`${from}T00:00`);
    if (to) filters.to = localInputToIso(`${addDays(to, 1)}T00:00`);
    listPayments(token, filters)
      .then(setPayments)
      .catch(() => setError("Не вдалося завантажити оплати"))
      .finally(() => setLoading(false));
  }, [token, studentId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (payment: Payment) => {
    if (!confirm("Видалити оплату?")) return;
    try {
      await deletePayment(token, payment.id);
      load();
    } catch {
      alert("Помилка видалення");
    }
  };

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Оплати</h1>
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditPayment(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Нова оплата
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="pp-from">З дати</Label>
            <Input
              id="pp-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-to">По дату</Label>
            <Input
              id="pp-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-student">Учень</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger id="pp-student" className="w-48">
                <SelectValue placeholder="Всі учні" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі учні</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            Оновити
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : payments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Оплат не знайдено</p>
        ) : (
          <>
            <div className="flex justify-end text-sm font-medium">
              Всього: <span className="ml-2 text-green-700">{formatMoney(total)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Учень</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Спосіб</TableHead>
                  <TableHead>Коментар</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{formatDateTime(p.paid_at)}</TableCell>
                    <TableCell>
                      <button
                        className="font-medium hover:underline"
                        onClick={() => navigate(`/students/${p.student_id}`)}
                      >
                        {p.student_full_name}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-700">
                      {formatMoney(p.amount)}
                    </TableCell>
                    <TableCell className="text-sm">{METHOD_LABEL[p.method]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.comment ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditPayment(p);
                            setFormOpen(true);
                          }}
                          title="Редагувати"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(p)}
                          title="Видалити"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      {formOpen && (
        <PaymentForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditPayment(undefined);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditPayment(undefined);
            load();
          }}
          initial={editPayment}
        />
      )}
    </Layout>
  );
}
