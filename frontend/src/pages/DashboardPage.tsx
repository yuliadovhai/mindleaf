import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { getDashboard } from "../api/dashboard";
import type { Dashboard } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatMoney } from "../lib/money";
import { formatTime, formatDate } from "../lib/datetime";
import { useRouter } from "../lib/router";
import { TrendingUp, AlertCircle, Calendar, Clock, BookOpen } from "lucide-react";

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
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
      <div className="w-12 h-12 rounded-2xl bg-[#EEEBFF] flex items-center justify-center">
        <Icon className="h-6 w-6 text-[#6D5DF6]" />
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

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
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{dateLabel}</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-start gap-4">
              <IconSquare icon={TrendingUp} bg="#E6F8EF" color="#059669" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Дохід за місяць</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5 leading-tight">
                  {formatMoney(data.income_month)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-4">
              <IconSquare icon={AlertCircle} bg="#FFE9E9" color="#DC2626" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Загальний борг</p>
                <p className="text-2xl font-extrabold text-destructive mt-0.5 leading-tight">
                  {formatMoney(data.debt_total)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <IconSquare icon={Calendar} bg="#E8F1FF" color="#2563EB" />
            <h2 className="text-base font-semibold text-foreground">Сьогодні</h2>
            {data.today.length > 0 && <Badge variant="secondary">{data.today.length}</Badge>}
          </div>
          {data.today.length === 0 ? (
            <Card>
              <EmptyState icon={Calendar} text="Занять сьогодні немає" />
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border/60">
                {data.today.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/students/${lesson.student_id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-mono text-muted-foreground w-12 flex-shrink-0">
                        {formatTime(lesson.starts_at)}
                      </span>
                      <span className="font-semibold text-foreground truncate">
                        {lesson.student_full_name}
                      </span>
                      {lesson.topic && (
                        <span className="text-sm text-muted-foreground truncate hidden sm:block">
                          — {lesson.topic}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">
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
          <div className="flex items-center gap-2.5 mb-3">
            <IconSquare icon={Clock} bg="#FFF1E6" color="#EA580C" />
            <h2 className="text-base font-semibold text-foreground">Найближчі 7 днів</h2>
            {data.upcoming.length > 0 && <Badge variant="secondary">{data.upcoming.length}</Badge>}
          </div>
          {data.upcoming.length === 0 ? (
            <Card>
              <EmptyState icon={Clock} text="Запланованих занять немає" />
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border/60">
                {data.upcoming.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/students/${lesson.student_id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">
                        {formatDate(lesson.starts_at)}, {formatTime(lesson.starts_at)}
                      </span>
                      <span className="font-semibold text-foreground truncate">
                        {lesson.student_full_name}
                      </span>
                      {lesson.topic && (
                        <span className="text-sm text-muted-foreground truncate hidden sm:block">
                          — {lesson.topic}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
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
            <div className="flex items-center gap-2.5 mb-3">
              <IconSquare icon={AlertCircle} bg="#FFE9E9" color="#DC2626" />
              <h2 className="text-base font-semibold text-foreground">Боржники</h2>
            </div>
            <Card>
              <div className="divide-y divide-border/60">
                {data.debtors.map((d) => (
                  <div
                    key={d.student_id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/students/${d.student_id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{d.full_name}</span>
                      {d.archived && (
                        <Badge variant="muted" className="text-xs">
                          архів
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-destructive text-sm">
                      {formatMoney(-d.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Empty debtors state — only shown when section is explicitly expected */}
        {data.debtors.length === 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-3">
              <IconSquare icon={BookOpen} bg="#E6F8EF" color="#059669" />
              <h2 className="text-base font-semibold text-foreground">Боржники</h2>
            </div>
            <Card>
              <EmptyState icon={BookOpen} text="Боржників немає — чудово!" />
            </Card>
          </section>
        )}
      </div>
    </Layout>
  );
}
