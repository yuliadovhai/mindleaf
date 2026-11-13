import { useState, useEffect } from "react";
import { useSession } from "../auth/session";
import { getDashboard } from "../api/dashboard";
import type { Dashboard } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatMoney } from "../lib/money";
import { formatDateTime } from "../lib/datetime";
import { useRouter } from "../lib/router";
import { TrendingUp, AlertCircle, Calendar, Clock, ClipboardCheck, ListChecks } from "lucide-react";
import type React from "react";

function IconSquare({
  icon: Icon,
  bg,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  bg: string;
  color: string;
}) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
  );
}

export function DashboardPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getDashboard(token)
      .then(setData)
      .catch(() => setError("Не вдалося завантажити дашборд"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <ErrorMessage message={error} />
      </Layout>
    );
  if (!data) return null;

  const dateLabel = new Date(data.date + "T00:00:00").toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{dateLabel}</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconSquare icon={TrendingUp} bg="#E6F8EF" color="#10B981" />
                Дохід за місяць
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(data.income_month)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconSquare icon={AlertCircle} bg="#FFF1E6" color="#F97316" />
                Загальний борг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatMoney(data.debt_total)}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/homework")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconSquare icon={ClipboardCheck} bg="#EEEBFF" color="#6D5DF6" />
                ДЗ на перевірку
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.homework_to_review}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/quizzes")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconSquare icon={ListChecks} bg="#E8F1FF" color="#3B82F6" />
                Тести на перевірку
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.quizzes_to_review}</p>
            </CardContent>
          </Card>
        </div>

        {/* Today */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <IconSquare icon={Calendar} bg="#E8F1FF" color="#3B82F6" />
            Сьогодні
            {data.today.length > 0 && <Badge variant="secondary">{data.today.length}</Badge>}
          </h2>
          {data.today.length === 0 ? (
            <p className="text-muted-foreground text-sm">Занять сьогодні немає</p>
          ) : (
            <Card>
              <div className="divide-y divide-border/60">
                {data.today.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/students/${lesson.student_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground">
                        {formatDateTime(lesson.starts_at).slice(12)}
                      </span>
                      <span className="font-medium">{lesson.student_full_name}</span>
                      {lesson.topic && (
                        <span className="text-sm text-muted-foreground">— {lesson.topic}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {lesson.duration_minutes} хв
                      </span>
                      <LessonStatusBadge status={lesson.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <IconSquare icon={Clock} bg="#EEEBFF" color="#6D5DF6" />
            Найближчі 7 днів
            {data.upcoming.length > 0 && <Badge variant="secondary">{data.upcoming.length}</Badge>}
          </h2>
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">Запланованих занять немає</p>
          ) : (
            <Card>
              <div className="divide-y divide-border/60">
                {data.upcoming.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/students/${lesson.student_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-32">
                        {formatDateTime(lesson.starts_at)}
                      </span>
                      <span className="font-medium">{lesson.student_full_name}</span>
                      {lesson.topic && (
                        <span className="text-sm text-muted-foreground">— {lesson.topic}</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {lesson.duration_minutes} хв
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* Debtors */}
        {data.debtors.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <IconSquare icon={AlertCircle} bg="#FFF1E6" color="#F97316" />
              Боржники
            </h2>
            <Card>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F7F6FE]">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Учень
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Борг
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.debtors.map((d) => (
                      <tr
                        key={d.student_id}
                        className="hover:bg-accent/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/students/${d.student_id}`)}
                      >
                        <td className="px-4 py-2">
                          {d.full_name}
                          {d.archived && (
                            <Badge variant="muted" className="ml-2 text-xs">
                              архів
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-destructive">
                          {formatMoney(-d.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}
      </div>
    </Layout>
  );
}
