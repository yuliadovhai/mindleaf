import { useState, useEffect, useCallback } from "react";
import { useSession } from "../auth/session";
import { listPayments, deletePayment } from "../api/payments";
import { listStudents } from "../api/students";
import type { Payment, Student } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { PaymentForm } from "../components/PaymentForm";
import { StudentBalances } from "../components/payments/StudentBalances";
import { PaymentRows } from "../components/payments/PaymentRows";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { SegmentedTabs } from "../components/common/SegmentedTabs";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { formatMoney } from "../lib/money";
import { localInputToIso, todayKyiv } from "../lib/datetime";
import { plural } from "../lib/plural";
import { Plus, CreditCard } from "lucide-react";

type Period = "month" | "last" | "all";

/** First day of this month and of the previous one, "YYYY-MM-DD". */
function monthStarts(today: string): { thisMonth: string; lastMonth: string } {
  const [y, m] = today.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { thisMonth: `${today.slice(0, 7)}-01`, lastMonth: `${prev}-01` };
}

export function PaymentsPage() {
  const { token } = useSession();

  const { thisMonth, lastMonth } = monthStarts(todayKyiv());
  const [period, setPeriod] = useState<Period>("month");
  const [studentId, setStudentId] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped after a change so the balances list reloads too.
  const [version, setVersion] = useState(0);

  const [form, setForm] = useState<{ initial?: Payment } | null>(null);

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
    if (period === "month") filters.from = localInputToIso(`${thisMonth}T00:00`);
    if (period === "last") {
      filters.from = localInputToIso(`${lastMonth}T00:00`);
      filters.to = localInputToIso(`${thisMonth}T00:00`);
    }
    listPayments(token, filters)
      .then(setPayments)
      .catch(() => setError("Не вдалося завантажити оплати"))
      .finally(() => setLoading(false));
  }, [token, studentId, period, thisMonth, lastMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    setVersion((v) => v + 1);
  };

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Layout>
      <div className="space-y-7">
        <PageHeader
          title="Оплати"
          subtitle="Хто скільки винен і що вже надійшло. Натисніть на учня, щоб побачити його історію."
          actions={
            <Button className="gap-1.5" onClick={() => setForm({})}>
              <Plus className="h-4 w-4" />
              Записати оплату
            </Button>
          }
        />

        <StudentBalances key={version} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Надходження</h2>
            {!loading && payments.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {plural(payments.length, ["оплата", "оплати", "оплат"])} на{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(total)}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SegmentedTabs
              value={period}
              onChange={setPeriod}
              items={[
                { value: "month", label: "Цей місяць" },
                { value: "last", label: "Минулий" },
                { value: "all", label: "Усі" },
              ]}
            />
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="sm:w-52" aria-label="Учень">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі учні</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : payments.length === 0 ? (
            <EmptyState icon={CreditCard} text="За цей період оплат немає" />
          ) : (
            <PaymentRows
              rows={payments.map((p) => ({
                key: p.id,
                at: p.paid_at,
                amount: p.amount,
                title: p.student_full_name,
                payment: p,
              }))}
              onPayment={(p) => setForm({ initial: p })}
            />
          )}
        </section>
      </div>

      {form && (
        <PaymentForm
          open
          initial={form.initial}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            changed();
          }}
          onDelete={async (p) => {
            await deletePayment(token, p.id);
            changed();
          }}
        />
      )}
    </Layout>
  );
}
