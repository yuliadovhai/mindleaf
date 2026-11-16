import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import { listMyLessons, listMyStudents } from "../../api/portal";
import { listMyAssignments } from "../../api/quizzes";
import { getLessonHomework, listMyHomeworkAssignments } from "../../api/homework";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PortalLessonRow } from "../../components/PortalLessonRow";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { formatMoney } from "../../lib/money";
import { formatWhenInline, isTodayKyiv } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { BookOpen, CalendarDays, ChevronRight, ListChecks, UserRound } from "lucide-react";

const DAY = 24 * 3600 * 1000;

interface TodoItem {
  key: string;
  kind: "homework" | "quiz";
  title: string;
  detail: string;
  due: string | null;
  to: string;
}

export function PortalHomePage() {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const isParent = me.role === "parent";

  const load = useCallback(async () => {
    const now = new Date();
    const inTwoWeeks = new Date(now.getTime() + 14 * DAY);
    const monthAgo = new Date(now.getTime() - 30 * DAY);
    const [students, lessons, recentLessons, quizzes, homework] = await Promise.all([
      listMyStudents(token),
      listMyLessons(token, { from: now.toISOString(), to: inTwoWeeks.toISOString() }),
      listMyLessons(token, { from: monthAgo.toISOString(), to: now.toISOString() }),
      listMyAssignments(token),
      listMyHomeworkAssignments(token),
    ]);
    // Homework given in a lesson counts as open until the student answers it.
    const withHomework = recentLessons.filter((l) => l.homework && l.status !== "cancelled");
    const answers = await Promise.all(withHomework.map((l) => getLessonHomework(token, l.id)));
    const lessonHomework = withHomework.filter((_, i) => answers[i] === null);
    return { students, lessons, quizzes, homework, lessonHomework };
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

  const openQuizzes = data.quizzes.filter((q) => q.status === "assigned");
  const many = data.students.length > 1;
  const who = (name: string) => (many ? ` · ${name}` : "");
  const todo: TodoItem[] = [
    ...data.homework
      .filter((h) => h.submission_status === null)
      .map((h) => ({
        key: `hw-${h.id}`,
        kind: "homework" as const,
        title: h.title,
        detail:
          (h.due_at ? `здати до ${formatWhenInline(h.due_at)}` : "без строку") +
          who(h.student_full_name),
        due: h.due_at,
        to: `/homework/${h.id}`,
      })),
    ...data.lessonHomework.map((l) => ({
      key: `lesson-${l.id}`,
      kind: "homework" as const,
      title: l.homework ?? "",
      detail: `з заняття ${formatWhenInline(l.starts_at)}` + who(l.student_full_name),
      due: null,
      to: `/lessons/${l.id}/homework`,
    })),
    ...openQuizzes.map((q) => ({
      key: `quiz-${q.id}`,
      kind: "quiz" as const,
      title: q.quiz_title,
      detail:
        (q.due_at ? `тест · до ${formatWhenInline(q.due_at)}` : "тест") + who(q.student_full_name),
      due: q.due_at,
      to: `/quizzes/${q.id}`,
    })),
  ].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const now = new Date().toISOString();
  const doneQuizzes = data.quizzes.filter((q) => q.status !== "assigned");

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
                    className={`text-base font-semibold ${s.balance < 0 ? "text-destructive" : "text-green-700 dark:text-green-400"}`}
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
          {data.students.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  {isParent ? "Що треба зробити дитині" : "Що зробити"}
                  {todo.length > 0 && (
                    <span className="text-muted-foreground font-normal">· {todo.length}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {todo.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">
                    Усе зроблено 👍 Нові ДЗ і тести з'являться тут.
                  </p>
                ) : (
                  <div className="divide-y">
                    {todo.slice(0, 5).map((item) => {
                      const overdue = item.due !== null && item.due < now;
                      const today = !overdue && item.due !== null && isTodayKyiv(item.due);
                      const Icon = item.kind === "quiz" ? ListChecks : BookOpen;
                      return (
                        <button
                          key={item.key}
                          onClick={() => navigate(item.to)}
                          className={`flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted/50 ${today ? "border-l-4 border-l-primary pl-5" : ""}`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {item.detail}
                            </span>
                          </span>
                          {overdue && <Badge variant="destructive">Прострочено</Badge>}
                          {today && <Badge>Сьогодні</Badge>}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {todo.length > 5 && (
                  <button
                    onClick={() => navigate("/homework")}
                    className="px-6 pt-2 text-sm font-medium text-primary hover:underline"
                  >
                    Ще {todo.length - 5}
                  </button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Найближчі заняття
            </h2>
            <button
              onClick={() => navigate("/schedule")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Увесь розклад
            </button>
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

        {doneQuizzes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Результати тестів
              </h2>
              <button
                onClick={() => navigate("/quizzes")}
                className="text-sm font-medium text-primary hover:underline"
              >
                Усі тести
              </button>
            </div>
            {doneQuizzes.slice(0, 3).map((q) => (
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
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}
