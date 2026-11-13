import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { listMyLessons } from "../../api/portal";
import type { PortalLesson } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PortalLessonRow } from "../../components/PortalLessonRow";
import { useLoad } from "../../lib/useLoad";

const DAY = 24 * 3600 * 1000;

export function PortalSchedulePage() {
  const { token } = useSession();
  const load = useCallback(() => {
    const now = Date.now();
    return listMyLessons(token, {
      from: new Date(now - 30 * DAY).toISOString(),
      to: new Date(now + 60 * DAY).toISOString(),
    });
  }, [token]);
  const { data, setData, loading, error } = useLoad(load);

  const replace = (changed: PortalLesson) =>
    setData((data ?? []).map((l) => (l.id === changed.id ? changed : l)));

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  const lessons = data ?? [];
  const now = new Date().toISOString();
  const upcoming = lessons.filter((l) => l.starts_at >= now);
  const past = lessons.filter((l) => l.starts_at < now).reverse();
  const many = new Set(lessons.map((l) => l.student_id)).size > 1;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Розклад</h1>
        {error && <ErrorMessage message={error} />}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Найближчі</h2>
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">Запланованих занять немає.</p>
          )}
          {upcoming.map((l) => (
            <PortalLessonRow key={l.id} lesson={l} showStudent={many} onChanged={replace} />
          ))}
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Минулі (30 днів)</h2>
          {past.length === 0 && <p className="text-sm text-muted-foreground">Немає.</p>}
          {past.map((l) => (
            <PortalLessonRow key={l.id} lesson={l} showStudent={many} onChanged={replace} />
          ))}
        </section>
      </div>
    </Layout>
  );
}
