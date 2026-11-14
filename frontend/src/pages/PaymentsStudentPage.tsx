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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatDateTime } from "../lib/datetime";
import { formatMoney } from "../lib/money";
import { CARD, METHOD_LABEL } from "../lib/labels";
import { useLoad } from "../lib/useLoad";
import { useRouter } from "../lib/router";
import { ArrowLeft, Pencil, Plus, Trash2, UserRound } from "lucide-react";

type Entry =
  | { kind: "payment"; at: string; amount: number; payment: Payment }
  | { kind: "lesson"; at: string; amount: number; lesson: Lesson };

/** One student's money: balance, then payments and charged lessons over time. */
export function PaymentsStudentPage({ id }: { id: string }) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | undefined>();

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/payments")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {student.full_name}
                {student.archived && <Badge variant="muted">архів</Badge>}
              </h1>
              <p className="text-sm text-muted-foreground">
                Оплати · {formatMoney(student.default_price)} за заняття
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => navigate(`/students/${student.id}`)}
            >
              <UserRound className="h-4 w-4" />
              Картка учня
            </Button>
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-muted-foreground">Баланс</p>
            <p
              className={`text-2xl font-bold ${student.balance < 0 ? "text-destructive" : student.balance > 0 ? "text-green-600" : ""}`}
            >
              {student.balance < 0
                ? `борг ${formatMoney(-student.balance)}`
                : formatMoney(student.balance)}
            </p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-muted-foreground">Усього сплачено</p>
            <p className="text-2xl font-bold text-green-700">{formatMoney(paid)}</p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-muted-foreground">Нараховано за заняття</p>
            <p className="text-2xl font-bold">{formatMoney(charged)}</p>
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Історія</h2>
          <p className="text-xs text-muted-foreground">
            Оплати додають до балансу, проведені заняття віднімають їхню ціну. Скасовані, пропущені
            й заплановані заняття не враховуються.
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ні оплат, ні проведених занять ще немає.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Що</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead className="text-right">Баланс після</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.kind}-${r.kind === "payment" ? r.payment.id : r.lesson.id}`}>
                    <TableCell className="text-sm">{formatDateTime(r.at)}</TableCell>
                    <TableCell className="text-sm">
                      {r.kind === "payment" ? (
                        <>
                          Оплата · {METHOD_LABEL[r.payment.method]}
                          {r.payment.comment && (
                            <span className="text-muted-foreground"> · {r.payment.comment}</span>
                          )}
                        </>
                      ) : (
                        <>
                          Заняття
                          {r.lesson.topic && (
                            <span className="text-muted-foreground"> · {r.lesson.topic}</span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${r.amount > 0 ? "text-green-700" : ""}`}
                    >
                      {r.amount > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(r.amount))}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${r.after < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {formatMoney(r.after)}
                    </TableCell>
                    <TableCell>
                      {r.kind === "payment" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Редагувати"
                            onClick={() => {
                              setEditPayment(r.payment);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Видалити"
                            onClick={async () => {
                              if (!window.confirm("Видалити оплату?")) return;
                              await deletePayment(token, r.payment.id);
                              await reload();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
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
            void reload();
          }}
          initial={editPayment}
          defaultStudentId={id}
        />
      )}
    </Layout>
  );
}
