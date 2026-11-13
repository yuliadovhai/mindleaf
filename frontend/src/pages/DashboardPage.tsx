import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
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
import { TrendingUp, AlertCircle, Calendar, Clock } from "lucide-react";

export function DashboardPage() {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold capitalize">{dateLabel}</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
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
                <AlertCircle className="h-4 w-4" />
                Загальний борг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatMoney(data.debt_total)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Today */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Сьогодні
            {data.today.length > 0 && <Badge variant="secondary">{data.today.length}</Badge>}
          </h2>
          {data.today.length === 0 ? (
            <p className="text-muted-foreground text-sm">Занять сьогодні немає</p>
          ) : (
            <div className="space-y-2">
              {data.today.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 cursor-pointer"
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
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Найближчі 7 днів
            {data.upcoming.length > 0 && <Badge variant="secondary">{data.upcoming.length}</Badge>}
          </h2>
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">Запланованих занять немає</p>
          ) : (
            <div className="space-y-2">
              {data.upcoming.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 cursor-pointer"
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
          )}
        </section>

        {/* Debtors */}
        {data.debtors.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Боржники
            </h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Учень</th>
                    <th className="px-4 py-2 text-right font-medium">Борг</th>
                  </tr>
                </thead>
                <tbody>
                  {data.debtors.map((d) => (
                    <tr
                      key={d.student_id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
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
          </section>
        )}
      </div>
    </Layout>
  );
}
