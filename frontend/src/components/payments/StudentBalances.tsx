import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listStudents } from "../../api/students";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import { Badge } from "../ui/badge";
import { formatMoney } from "../../lib/money";
import { CARD } from "../../lib/labels";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ChevronRight } from "lucide-react";

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Баланси учнів</h2>
        <div className="flex items-center gap-4 text-sm">
          {debt > 0 && (
            <span>
              Борг разом:{" "}
              <span className="font-semibold text-destructive">{formatMoney(debt)}</span>
            </span>
          )}
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              className="accent-[#6D5DF6]"
              checked={withArchived}
              onChange={() => setWithArchived(!withArchived)}
            />
            з архівом
          </label>
        </div>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {data && data.length > 0 && (
        <ul className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
          {data.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => navigate(`/payments/students/${s.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{s.full_name}</span>
                    {s.archived && <Badge variant="muted">архів</Badge>}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[s.subject, `${formatMoney(s.default_price)} за заняття`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <span
                    className={`block font-semibold ${
                      s.balance < 0
                        ? "text-destructive"
                        : s.balance > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatMoney(Math.abs(s.balance))}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.balance < 0 ? "борг" : s.balance > 0 ? "передплата" : "розраховано"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
