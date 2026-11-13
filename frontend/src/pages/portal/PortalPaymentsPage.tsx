import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { listMyPayments, listMyStudents } from "../../api/portal";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatDateTime } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { METHOD_LABEL } from "../../lib/labels";
import { useLoad } from "../../lib/useLoad";

/** Parents only: balances and the payment history of their children. */
export function PortalPaymentsPage() {
  const { token } = useSession();
  const load = useCallback(async () => {
    const [students, payments] = await Promise.all([listMyStudents(token), listMyPayments(token)]);
    return { students, payments };
  }, [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error || !data)
    return (
      <Layout>
        <ErrorMessage message={error || "Немає даних"} />
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Оплати</h1>
        <div className="flex flex-wrap gap-3">
          {data.students.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">{s.full_name}</p>
              <p
                className={`text-lg font-semibold ${(s.balance ?? 0) < 0 ? "text-destructive" : "text-green-700"}`}
              >
                {(s.balance ?? 0) < 0
                  ? `Борг ${formatMoney(-(s.balance ?? 0))}`
                  : `Баланс ${formatMoney(s.balance ?? 0)}`}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Баланс = оплати − вартість проведених занять. Скасовані й заплановані заняття не
          враховуються.
        </p>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Оплат ще не було.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Учень</TableHead>
                  <TableHead>Спосіб</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                    <TableCell>{p.student_full_name}</TableCell>
                    <TableCell>{METHOD_LABEL[p.method]}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
