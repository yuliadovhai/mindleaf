import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listMyAssignments } from "../../api/quizzes";
import type { Assignment } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { Badge } from "../../components/ui/badge";
import { formatWhenInline, isTodayKyiv } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";

type Tab = "todo" | "results";

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Red below half, amber below 80 %, green from 80 %. */
function scoreColor(percent: number): string {
  if (percent < 50) return "bg-destructive";
  if (percent < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function PortalQuizzesPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const load = useCallback(() => listMyAssignments(token), [token]);
  const { data, loading, error } = useLoad(load);
  const [tab, setTab] = useState<Tab>("todo");

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  const all = data ?? [];
  const many = new Set(all.map((a) => a.student_id)).size > 1;
  const todo = all
    .filter((a) => a.status === "assigned")
    .sort((a, b) => {
      if (a.due_at && b.due_at) return cmp(a.due_at, b.due_at);
      if (a.due_at || b.due_at) return a.due_at ? -1 : 1;
      return cmp(a.created_at, b.created_at);
    });
  const results = all
    .filter((a) => a.status !== "assigned")
    .sort((a, b) => cmp(b.submitted_at ?? b.created_at, a.submitted_at ?? a.created_at));
  const shown = tab === "todo" ? todo : results;
  const now = new Date().toISOString();

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Тести</h1>
        {error && <ErrorMessage message={error} />}

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "todo", label: "Треба пройти", count: todo.length },
            { value: "results", label: "Результати" },
          ]}
        />

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {tab === "todo"
              ? all.length === 0
                ? "Тестів поки немає — репетитор надішле їх сюди."
                : "Усі тести пройдено 🎉"
              : "Результатів ще немає — пройдіть перший тест."}
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map((a) => (
              <QuizRow
                key={a.id}
                a={a}
                many={many}
                now={now}
                onOpen={() => navigate(`/quizzes/${a.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function QuizRow({
  a,
  many,
  now,
  onOpen,
}: {
  a: Assignment;
  many: boolean;
  now: string;
  onOpen: () => void;
}) {
  const open = a.status === "assigned";
  const overdue = open && a.due_at !== null && a.due_at < now;
  const today = open && !overdue && a.due_at !== null && isTodayKyiv(a.due_at);
  const percent =
    a.score !== null && a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : null;

  // Two runs of the same quiz look alike, so every row says when it was given or handed in.
  const when = open
    ? [
        a.due_at ? `пройти до ${formatWhenInline(a.due_at)}` : null,
        `призначено ${formatWhenInline(a.created_at)}`,
      ]
    : [a.submitted_at ? `здано ${formatWhenInline(a.submitted_at)}` : null];
  const detail = [many ? a.student_full_name : null, ...when].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-2xl border border-border bg-card px-4 py-3 text-left hover:bg-accent/40 transition-colors shadow-[0_4px_20px_rgba(109,93,246,0.06)] ${
        today ? "border-l-4 border-l-primary" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-medium">{a.quiz_title}</span>
          <span
            className={`block text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
          >
            {detail}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {percent !== null && (
            <span className="flex items-center gap-2">
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                <span
                  className={`block h-full rounded-full ${scoreColor(percent)}`}
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="text-sm font-medium tabular-nums">
                {a.score}/{a.max_score}
                <span className="font-normal text-muted-foreground"> · {percent}%</span>
              </span>
            </span>
          )}
          {overdue ? (
            <Badge variant="destructive">Прострочено</Badge>
          ) : today ? (
            <Badge>Сьогодні</Badge>
          ) : (
            <AssignmentStatusBadge status={a.status} />
          )}
        </span>
      </div>
    </button>
  );
}
