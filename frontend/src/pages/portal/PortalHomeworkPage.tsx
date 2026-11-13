import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { listMyLessons } from "../../api/portal";
import { getLessonHomework } from "../../api/homework";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Badge } from "../../components/ui/badge";
import { formatDate } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";

const DAY = 24 * 3600 * 1000;

/** Every lesson with homework in the last 60 days, and where its answer stands. */
export function PortalHomeworkPage() {
  const { token } = useSession();
  const { navigate } = useRouter();

  const load = useCallback(async () => {
    const now = Date.now();
    const lessons = (
      await listMyLessons(token, {
        from: new Date(now - 60 * DAY).toISOString(),
        to: new Date(now + 14 * DAY).toISOString(),
      })
    )
      .filter((l) => l.homework)
      .reverse();
    const answers = await Promise.all(lessons.map((l) => getLessonHomework(token, l.id)));
    return lessons.map((lesson, i) => ({ lesson, answer: answers[i] }));
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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Домашні завдання</h1>
        {error && <ErrorMessage message={error} />}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Домашніх завдань поки немає.</p>
        )}
        {data?.map(({ lesson, answer }) => (
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
              {!answer && <Badge variant="warning">Не здано</Badge>}
              {answer?.status === "submitted" && <Badge variant="secondary">Здано, чекає</Badge>}
              {answer?.status === "reviewed" && (
                <Badge variant="success">
                  Перевірено{answer.grade !== null ? ` · ${answer.grade}/12` : ""}
                </Badge>
              )}
            </div>
            <p className="font-medium">{lesson.homework}</p>
          </button>
        ))}
      </div>
    </Layout>
  );
}
