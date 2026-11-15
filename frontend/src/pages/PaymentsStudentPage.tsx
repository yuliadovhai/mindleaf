import { useCallback, useState } from "react";
import { useSession } from "../auth/session";
import { getStudent } from "../api/students";
import { listLessons } from "../api/lessons";
import { deletePayment, listPayments } from "../api/payments";
import type { Lesson, Payment } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { PaymentForm } from "../components/PaymentForm";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { PaymentRows } from "../components/payments/PaymentRows";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { formatMoney } from "../lib/money";
import { CARD } from "../lib/labels";
import { useLoad } from "../lib/useLoad";
import { useRouter } from "../lib/router";
import { ArrowLeft, Plus, UserRound, Wallet } from "lucide-react";

type Entry =
  | { kind: "payment"; at: string; amount: number; payment: Payment }
  | { kind: "lesson"; at: string; amount: number; lesson: Lesson };

/** One student's money: balance, then payments and charged lessons over time. */
export function PaymentsStudentPage({ id }: { id: string }) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [form, setForm] = useState<{ initial?: Payment } | null>(null);

  const load = useCallback(async () => {
    const [student, payments, lessons] = await Promise.all([
      getStudent(token, id),
      listPayments(token, { student_id: id }),
      listLessons(token, { student_id: id, status: "done" }),
    ]);
    const entries: Entry[] = [
      ...payments.map((p) => ({
        kind: "payment" as const,
        at: p.paid_at,
        amount: p.amount,
        payment: p,
      })),
      ...lessons.map((l) => ({
        kind: "lesson" as const,
        at: l.starts_at,
        amount: -l.price,
        lesson: l,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    // Running balance from the first entry; shown newest first.
    let running = 0;
    const withBalance = entries.map((e) => ({ ...e, after: (running += e.amount) }));
    return { student, payments, rows: withBalance.reverse() };
  }, [token, id]);
  const { data, loading, error, reload } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error || !data)
    return (
      <Layout>
        <ErrorMessage message={error || "Не знайдено"} />
      </Layout>
    );

  const { student, payments, rows } = data;
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const charged = paid - student.balance;

  return (
    <Layout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 gap-1.5"
          onClick={() => navigate("/payments")}
        >
          <ArrowLeft className="h-4 w-4" />
          Оплати
        </Button>

        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {student.full_name}
              {student.archived && <Badge variant="muted">архів</Badge>}
            </span>
          }
          subtitle={`${formatMoney(student.default_price)} за заняття`}
          actions={
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <UserRound className="h-4 w-4" />
                Картка учня
              </Button>
              <Button className="gap-1.5" onClick={() => setForm({})}>
                <Plus className="h-4 w-4" />
                Записати оплату
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className={`${CARD} col-span-2 p-4 sm:col-span-1`}>
            <p className="text-sm text-muted-foreground">
              {student.balance < 0 ? "Борг" : student.balance > 0 ? "Передплата" : "Баланс"}
            </p>
            <p
              className={`text-2xl font-bold ${student.balance < 0 ? "text-destructive" : student.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {formatMoney(Math.abs(student.balance))}
            </p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-muted-foreground">Сплачено</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 sm:text-2xl">
              {formatMoney(paid)}
            </p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-muted-foreground">За заняття</p>
            <p className="text-lg font-bold sm:text-2xl">{formatMoney(charged)}</p>
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Історія</h2>
            <p className="text-sm text-muted-foreground">
              Оплата додає до балансу, проведене заняття віднімає свою ціну. Скасовані, пропущені й
              заплановані заняття не рахуються.
            </p>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Wallet} text="Ні оплат, ні проведених занять ще немає." />
          ) : (
            <PaymentRows
              rows={rows.map((r) => ({
                key: `${r.kind}-${r.kind === "payment" ? r.payment.id : r.lesson.id}`,
                at: r.at,
                amount: r.amount,
                after: r.after,
                title: r.kind === "payment" ? "Оплата" : "Заняття",
                payment: r.kind === "payment" ? r.payment : undefined,
                lesson: r.kind === "lesson" ? r.lesson : undefined,
              }))}
              onPayment={(p) => setForm({ initial: p })}
            />
          )}
        </section>
      </div>

      {form && (
        <PaymentForm
          open
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void reload();
          }}
          onDelete={async (p) => {
            await deletePayment(token, p.id);
            await reload();
          }}
          initial={form.initial}
          defaultStudentId={id}
        />
      )}
    </Layout>
  );
}
