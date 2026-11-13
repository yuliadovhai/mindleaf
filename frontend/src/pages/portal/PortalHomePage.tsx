import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import { listMyLessons, listMyStudents } from "../../api/portal";
import { listMyAssignments } from "../../api/quizzes";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PortalLessonRow } from "../../components/PortalLessonRow";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { CalendarDays, ListChecks, UserRound } from "lucide-react";

export function PortalHomePage() {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const isParent = me.role === "parent";

  const load = useCallback(async () => {
    const now = new Date();
    const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    const [students, lessons, quizzes] = await Promise.all([
      listMyStudents(token),
      listMyLessons(token, { from: now.toISOString(), to: inTwoWeeks.toISOString() }),
      listMyAssignments(token),
    ]);
    return { students, lessons, quizzes };
  }, [token]);
  const { data, setData, loading, error } = useLoad(load);

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
  const openQuizzes = data.quizzes.filter((q) => q.status === "assigned");

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{me.name ? `Вітаємо, ${me.name}!` : "Вітаємо!"}</h1>

        {data.students.length === 0 && (
          <ErrorMessage message="Доступу до жодного учня немає. Попросіть у репетитора новий код." />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {data.students.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5" />
                  {s.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {s.subject && <p>Предмет: {s.subject}</p>}
                {s.tutor_name && <p className="text-muted-foreground">Репетитор: {s.tutor_name}</p>}
                {s.balance !== null && (
                  <p
                    className={`text-base font-semibold ${s.balance < 0 ? "text-destructive" : "text-green-700"}`}
                  >
                    {s.balance < 0
                      ? `Борг: ${formatMoney(-s.balance)}`
                      : s.balance > 0
                        ? `Передоплата: ${formatMoney(s.balance)}`
                        : "Розрахунок повний"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Найближчі заняття
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/schedule")}>
              Увесь розклад
            </Button>
          </div>
          {data.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Найближчі два тижні занять немає.</p>
          ) : (
            data.lessons.map((lesson) => (
              <PortalLessonRow
                key={lesson.id}
                lesson={lesson}
                showStudent={many}
                onChanged={(changed) =>
                  setData({
                    ...data,
                    lessons: data.lessons.map((l) => (l.id === changed.id ? changed : l)),
                  })
                }
              />
            ))
          )}
          {isParent && (
            <p className="text-xs text-muted-foreground">
              Скасувати заняття можна заздалегідь — строк задає репетитор.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {isParent ? "Тести" : "Тести, які треба пройти"}
          </h2>
          {(isParent ? data.quizzes : openQuizzes).length === 0 ? (
            <p className="text-sm text-muted-foreground">Немає.</p>
          ) : (
            (isParent ? data.quizzes : openQuizzes).slice(0, 5).map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(`/quizzes/${q.id}`)}
                className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50"
              >
                <span className="font-medium">
                  {q.quiz_title}
                  {many && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      — {q.student_full_name}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {q.score !== null && (
                    <span className="text-sm">
                      {q.score}/{q.max_score}
                    </span>
                  )}
                  <AssignmentStatusBadge status={q.status} />
                </span>
              </button>
            ))
          )}
        </section>
      </div>
    </Layout>
  );
}
