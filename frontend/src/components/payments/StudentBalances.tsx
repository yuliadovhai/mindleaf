import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listStudents } from "../../api/students";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatMoney } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { History } from "lucide-react";

/** Every student's balance, debtors first; a row opens their payment history. */
export function StudentBalances() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [withArchived, setWithArchived] = useState(false);
  const load = useCallback(async () => {
    const active = await listStudents(token, false);
    const archived = withArchived ? await listStudents(token, true) : [];
    return [...active, ...archived].sort(
      (a, b) => a.balance - b.balance || a.full_name.localeCompare(b.full_name, "uk")
    );
  }, [token, withArchived]);
  const { data, loading, error } = useLoad(load);

  const debt = (data ?? []).reduce((sum, s) => sum + Math.max(0, -s.balance), 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Баланси учнів</h2>
        <div className="flex items-center gap-3 text-sm">
          {debt > 0 && (
            <span>
              Загальний борг:{" "}
              <span className="font-semibold text-destructive">{formatMoney(debt)}</span>
            </span>
          )}
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              checked={withArchived}
              onChange={() => setWithArchived(!withArchived)}
            />
            з архівними
          </label>
        </div>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Учень</TableHead>
              <TableHead>Предмет</TableHead>
              <TableHead className="text-right">Ціна заняття</TableHead>
              <TableHead className="text-right">Баланс</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() => navigate(`/payments/students/${s.id}`)}
              >
                <TableCell className="font-medium">
                  {s.full_name}
                  {s.archived && (
                    <Badge variant="muted" className="ml-2 text-xs">
                      архів
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.subject ?? "—"}</TableCell>
                <TableCell className="text-right">{formatMoney(s.default_price)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      s.balance < 0
                        ? "text-destructive font-medium"
                        : s.balance > 0
                          ? "text-green-600 font-medium"
                          : "text-muted-foreground"
                    }
                  >
                    {s.balance < 0 ? `борг ${formatMoney(-s.balance)}` : formatMoney(s.balance)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Історія оплат">
                    <History className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
