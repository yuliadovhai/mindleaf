import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { listMyLessons } from "../../api/portal";
import { getLessonHomework, listMyHomeworkAssignments } from "../../api/homework";
import type { SubmissionStatus } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Badge } from "../../components/ui/badge";
import { formatDate, formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { Paperclip } from "lucide-react";

const DAY = 24 * 3600 * 1000;

function StatusBadge({ status, grade }: { status: SubmissionStatus | null; grade: number | null }) {
  if (status === null) return <Badge variant="warning">Не здано</Badge>;
  if (status === "submitted") return <Badge variant="secondary">Здано, чекає</Badge>;
  return <Badge variant="success">Перевірено{grade !== null ? ` · ${grade}/12` : ""}</Badge>;
}

/** Homework assignments, then homework given in lessons (last 60 days). */
export function PortalHomeworkPage() {
  const { token } = useSession();
  const { navigate } = useRouter();

  const load = useCallback(async () => {
    const now = Date.now();
    const [assignments, lessons] = await Promise.all([
      listMyHomeworkAssignments(token),
      listMyLessons(token, {
        from: new Date(now - 60 * DAY).toISOString(),
        to: new Date(now + 14 * DAY).toISOString(),
      }),
    ]);
    const withHomework = lessons.filter((l) => l.homework).reverse();
    const answers = await Promise.all(withHomework.map((l) => getLessonHomework(token, l.id)));
    return {
      assignments,
      lessons: withHomework.map((lesson, i) => ({ lesson, answer: answers[i] })),
    };
  }, [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Домашні завдання</h1>
        {error && <ErrorMessage message={error} />}

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Завдання</h2>
          {data?.assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">Окремих завдань немає.</p>
          )}
          {data?.assignments.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/homework/${a.id}`)}
              className="w-full rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50 space-y-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                <StatusBadge status={a.submission_status} grade={a.grade} />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-3">
                {a.due_at ? `Здати до ${formatDateTime(a.due_at)}` : "Без строку"}
                {a.materials.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {a.materials.length}
                  </span>
                )}
              </p>
            </button>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">З занять</h2>
          {data?.lessons.length === 0 && (
            <p className="text-sm text-muted-foreground">Домашніх завдань із занять немає.</p>
          )}
          {data?.lessons.map(({ lesson, answer }) => (
            <button
              key={lesson.id}
              onClick={() => navigate(`/lessons/${lesson.id}/homework`)}
              className="w-full rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50 space-y-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Заняття {formatDate(lesson.starts_at)}
                  {lesson.topic ? ` · ${lesson.topic}` : ""}
                </span>
                <StatusBadge status={answer?.status ?? null} grade={answer?.grade ?? null} />
              </div>
              <p className="font-medium">{lesson.homework}</p>
            </button>
          ))}
        </section>
      </div>
    </Layout>
  );
}
