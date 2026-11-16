import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import { listMyLessons } from "../../api/portal";
import { getLessonHomework, listMyHomeworkAssignments } from "../../api/homework";
import type { SubmissionStatus } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { Badge } from "../../components/ui/badge";
import { formatWhenInline, isTodayKyiv } from "../../lib/datetime";
import { plural } from "../../lib/plural";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { BookOpen, CalendarDays, Paperclip } from "lucide-react";

const DAY = 24 * 3600 * 1000;

type Tab = "todo" | "submitted" | "reviewed";

const TAB_OF: Record<"none" | SubmissionStatus, Tab> = {
  none: "todo",
  submitted: "submitted",
  reviewed: "reviewed",
};

const EMPTY: Record<Tab, string> = {
  todo: "Усе здано 👍 Нові завдання з'являться тут.",
  submitted: "Немає здач, які чекають на перевірку.",
  reviewed: "Перевірених завдань ще немає.",
};

/** One row of the list: a standalone assignment or homework given in a lesson. */
interface Item {
  key: string;
  title: string;
  /** "здати до …" or "з заняття …" */
  when: string;
  /** Deadline used for sorting and the overdue / today marks. */
  due: string | null;
  /** Fallback sort key when there is no deadline. */
  sortAt: string;
  fromLesson: boolean;
  status: SubmissionStatus | null;
  grade: number | null;
  materials: number;
  student: string;
  to: string;
}

/** Homework split by what the student has to do: hand in, waiting, reviewed. */
export function PortalHomeworkPage() {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const isParent = me.role === "parent";
  const [tab, setTab] = useState<Tab>("todo");

  const load = useCallback(async () => {
    const now = Date.now();
    const [assignments, lessons] = await Promise.all([
      listMyHomeworkAssignments(token),
      listMyLessons(token, {
        from: new Date(now - 60 * DAY).toISOString(),
        to: new Date(now + 14 * DAY).toISOString(),
      }),
    ]);
    const withHomework = lessons.filter((l) => l.homework && l.status !== "cancelled");
    const answers = await Promise.all(withHomework.map((l) => getLessonHomework(token, l.id)));

    const items: Item[] = [
      ...assignments.map((a) => ({
        key: `a-${a.id}`,
        title: a.title,
        when: a.due_at ? `здати до ${formatWhenInline(a.due_at)}` : "без дедлайну",
        due: a.due_at,
        sortAt: a.created_at,
        fromLesson: false,
        status: a.submission_status,
        grade: a.grade,
        materials: a.materials.length,
        student: a.student_full_name,
        to: `/homework/${a.id}`,
      })),
      ...withHomework.map((l, i) => ({
        key: `l-${l.id}`,
        title: l.homework ?? "",
        when: `з заняття ${formatWhenInline(l.starts_at)}${l.topic ? ` · ${l.topic}` : ""}`,
        due: null,
        sortAt: l.starts_at,
        fromLesson: true,
        status: answers[i]?.status ?? null,
        grade: answers[i]?.grade ?? null,
        materials: 0,
        student: l.student_full_name,
        to: `/lessons/${l.id}/homework`,
      })),
    ];
    return items;
  }, [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  const items = data ?? [];
  const many = new Set(items.map((i) => i.student)).size > 1;
  const byTab = (t: Tab) => items.filter((i) => TAB_OF[i.status ?? "none"] === t);
  const now = new Date().toISOString();

  // To hand in: the most urgent deadline first, then lesson homework (oldest first).
  // Handed in / reviewed: the most recent first.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const shown = byTab(tab).sort((a, b) => {
    if (tab !== "todo") return cmp(b.due ?? b.sortAt, a.due ?? a.sortAt);
    if (a.due && b.due) return cmp(a.due, b.due);
    if (a.due || b.due) return a.due ? -1 : 1;
    return cmp(a.sortAt, b.sortAt);
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Домашні завдання</h1>
          {isParent && (
            <p className="text-sm text-muted-foreground">
              Завдання здає дитина у своєму кабінеті — тут видно, що вже зроблено.
            </p>
          )}
        </div>
        {error && <ErrorMessage message={error} />}

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "todo", label: "Треба здати", count: byTab("todo").length },
            { value: "submitted", label: "Здано", count: byTab("submitted").length },
            { value: "reviewed", label: "Перевірено" },
          ]}
        />

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {EMPTY[tab]}
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map((item) => {
              const open = item.status === null;
              const overdue = open && item.due !== null && item.due < now;
              const today = open && !overdue && item.due !== null && isTodayKyiv(item.due);
              const Icon = item.fromLesson ? CalendarDays : BookOpen;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.to)}
                  className={`w-full rounded-2xl border border-border bg-card px-4 py-3 text-left hover:bg-accent/40 transition-colors shadow-[0_4px_20px_rgba(109,93,246,0.06)] ${
                    today ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {item.title}
                          {many && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              — {item.student}
                            </span>
                          )}
                        </span>
                        {overdue ? (
                          <Badge variant="destructive">Прострочено</Badge>
                        ) : today ? (
                          <Badge>Сьогодні</Badge>
                        ) : (
                          <StatusBadge status={item.status} grade={item.grade} />
                        )}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className={overdue ? "text-destructive" : ""}>{item.when}</span>
                        {item.materials > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {plural(item.materials, ["матеріал", "матеріали", "матеріалів"])}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatusBadge({ status, grade }: { status: SubmissionStatus | null; grade: number | null }) {
  if (status === null) return <Badge variant="warning">Не здано</Badge>;
  if (status === "submitted") return <Badge variant="secondary">Здано, чекає</Badge>;
  return <Badge variant="success">Перевірено{grade !== null ? ` · ${grade}/12` : ""}</Badge>;
}
