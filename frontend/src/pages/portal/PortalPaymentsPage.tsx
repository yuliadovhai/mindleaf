import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listMyLessons, listMyPayments, listMyStudents } from "../../api/portal";
import type { PortalLesson, PortalPayment, PortalStudent } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { formatLessonWhen } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { METHOD_LABEL } from "../../lib/labels";
import { plural } from "../../lib/plural";
import { useLoad } from "../../lib/useLoad";
import { BookOpen, CalendarClock, Wallet } from "lucide-react";

const DAY = 24 * 3600 * 1000;

type Filter = "all" | "payments" | "lessons";

/** One line of the history: money in (a payment) or out (a lesson that took place). */
interface Entry {
  key: string;
  at: string;
  studentId: string;
  student: string;
  kind: "payment" | "lesson";
  title: string;
  /** Shown after the date, e.g. "60 хв". */
  extra?: string;
  amount: number; // kopecks, + for a payment, − for a lesson
  balanceAfter: number;
}

const MONTH = new Intl.DateTimeFormat("uk-UA", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

const monthOf = (iso: string) => {
  const text = MONTH.format(new Date(iso)).replace(" р.", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const signed = (kopecks: number) =>
  `${kopecks > 0 ? "+" : kopecks < 0 ? "−" : ""}${formatMoney(Math.abs(kopecks))}`;

/**
 * Balance = payments − price of done lessons; the API gives the current balance, so
 * walking the history from the newest entry back yields the balance after each one.
 */
function buildHistory(
  students: PortalStudent[],
  payments: PortalPayment[],
  lessons: PortalLesson[]
): Entry[] {
  const entries: Omit<Entry, "balanceAfter">[] = [
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      at: p.paid_at,
      studentId: p.student_id,
      student: p.student_full_name,
      kind: "payment" as const,
      title: `Оплата · ${METHOD_LABEL[p.method]}`,
      amount: p.amount,
    })),
    ...lessons
      .filter((l) => l.status === "done" && l.price !== null)
      .map((l) => ({
        key: `l-${l.id}`,
        at: l.starts_at,
        studentId: l.student_id,
        student: l.student_full_name,
        kind: "lesson" as const,
        title: l.topic ? `Заняття · ${l.topic}` : "Заняття",
        extra: `${l.duration_minutes} хв`,
        amount: -(l.price ?? 0),
      })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const running = new Map(students.map((s) => [s.id, s.balance ?? 0]));
  return entries.map((e) => {
    const after = running.get(e.studentId) ?? 0;
    running.set(e.studentId, after - e.amount);
    return { ...e, balanceAfter: after };
  });
}

/** Parents only: where each child's balance comes from, and what is coming up. */
export function PortalPaymentsPage() {
  const { token } = useSession();
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const [students, payments, lessons] = await Promise.all([
      listMyStudents(token),
      listMyPayments(token),
      listMyLessons(token),
    ]);
    return { students, payments, lessons };
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

  const many = data.students.length > 1;
  const history = buildHistory(data.students, data.payments, data.lessons);
  const shown = history.filter(
    (e) =>
      filter === "all" ||
      (filter === "payments" && e.kind === "payment") ||
      (filter === "lessons" && e.kind === "lesson")
  );
  const now = Date.now();
  const soon = new Date(now + 14 * DAY).toISOString();
  const nowIso = new Date(now).toISOString();

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Оплати</h1>

        <div className="grid gap-4 md:grid-cols-2">
          {data.students.map((s) => {
            const balance = s.balance ?? 0;
            const paid = data.payments
              .filter((p) => p.student_id === s.id)
              .reduce((sum, p) => sum + p.amount, 0);
            const done = data.lessons.filter((l) => l.student_id === s.id && l.status === "done");
            const doneSum = done.reduce((sum, l) => sum + (l.price ?? 0), 0);
            const upcoming = data.lessons.filter(
              (l) =>
                l.student_id === s.id &&
                l.status === "planned" &&
                l.starts_at >= nowIso &&
                l.starts_at < soon
            );
            const upcomingSum = upcoming.reduce((sum, l) => sum + (l.price ?? 0), 0);
            const tone =
              balance < 0
                ? "text-destructive"
                : balance > 0
                  ? "text-primary"
                  : "text-green-700 dark:text-green-400";
            return (
              <div
                key={s.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
              >
                <p className="text-sm text-muted-foreground">
                  {s.full_name}
                  {s.tutor_name ? ` · репетитор ${s.tutor_name}` : ""}
                </p>
                <div>
                  <p className={`text-2xl font-semibold ${tone}`}>
                    {balance < 0
                      ? `Борг ${formatMoney(-balance)}`
                      : balance > 0
                        ? `Передоплата ${formatMoney(balance)}`
                        : "Розрахунок повний"}
                  </p>
                  {balance < 0 && (
                    <p className="text-sm text-muted-foreground">
                      Оплатіть репетитору зручним способом — він відмітить оплату, і борг зникне.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Оплачено</p>
                    <p className="font-medium">{formatMoney(paid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {plural(done.length, [
                        "заняття проведено",
                        "заняття проведено",
                        "занять проведено",
                      ])}
                    </p>
                    <p className="font-medium">{formatMoney(doneSum)}</p>
                  </div>
                </div>
                {upcoming.length > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Наступні 2 тижні: {plural(upcoming.length, ["заняття", "заняття", "занять"])}{" "}
                      на <span className="font-medium">{formatMoney(upcomingSum)}</span>
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Історія</h2>
            <SegmentedTabs
              value={filter}
              onChange={setFilter}
              items={[
                { value: "all", label: "Усе" },
                { value: "payments", label: "Оплати" },
                { value: "lessons", label: "Заняття" },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {filter === "lessons" ? "Проведених занять ще немає." : "Оплат ще не було."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
              {shown.map((e, i) => {
                const month = monthOf(e.at);
                const newMonth = i === 0 || monthOf(shown[i - 1].at) !== month;
                const Icon = e.kind === "payment" ? Wallet : BookOpen;
                return (
                  <div key={e.key}>
                    {newMonth && (
                      <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {month}
                      </p>
                    )}
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          e.kind === "payment"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.title}
                          {many && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              — {e.student}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLessonWhen(e.at)}
                          {e.extra ? ` · ${e.extra}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            e.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : ""
                          }`}
                        >
                          {signed(e.amount)}
                        </p>
                        <p
                          className={`text-xs tabular-nums ${e.balanceAfter < 0 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          баланс {signed(e.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Баланс рахується так: усі оплати мінус вартість проведених занять. Заплановані й
            скасовані заняття на баланс не впливають.
          </p>
        </section>
      </div>
    </Layout>
  );
}
