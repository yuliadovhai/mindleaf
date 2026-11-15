import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { getDashboard } from "../api/dashboard";
import { listLessons } from "../api/lessons";
import type { Lesson } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { LessonForm } from "../components/LessonForm";
import { PaymentForm } from "../components/PaymentForm";
import { StudentForm } from "../components/StudentForm";
import { HomeworkAssignmentDialog } from "../components/HomeworkAssignmentDialog";
import { LessonDialog } from "../components/lessons/LessonDialog";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { MarkDoneButton } from "../components/lessons/LessonList";
import { hhmm, lessonClock, needsMark, dayLong } from "../components/lessons/lessonTime";
import { formatMoney } from "../lib/money";
import { formatDate } from "../lib/datetime";
import { CARD } from "../lib/labels";
import { plural } from "../lib/plural";
import { useLoad } from "../lib/useLoad";
import { useRouter } from "../lib/router";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardPlus,
  ListChecks,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";

type Dialog = "lesson" | "payment" | "homework" | "student";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", hour12: false })
  );
  if (hour < 12) return "Доброго ранку";
  if (hour < 18) return "Добрий день";
  return "Добрий вечір";
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${CARD} flex items-center gap-3 p-3 text-left text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-accent/40 sm:flex-col sm:items-start sm:p-4`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </span>
      {label}
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TodoRow({
  icon: Icon,
  tone,
  text,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: string;
  text: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{text}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function DashboardPage() {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [open, setOpen] = useState<Lesson | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);

  const load = useCallback(async () => {
    const [dashboard, unmarked] = await Promise.all([
      getDashboard(token),
      listLessons(token, { to: new Date().toISOString(), status: "planned" }),
    ]);
    return { dashboard, unmarked };
  }, [token]);
  const { data, loading, error, reload } = useLoad(load);

  const firstName = (me.name ?? "").split(" ")[0];
  const close = () => setDialog(null);
  const saved = () => {
    setDialog(null);
    void reload();
  };

  if (loading && !data) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout>
        <ErrorMessage message="Не вдалося завантажити головну сторінку" />
      </Layout>
    );
  }

  const { dashboard: d } = data;
  // Earlier days' lessons that still wait for a mark; today's show in the timeline.
  const overdue = data.unmarked.filter((l) => lessonClock(l).date < d.date);
  const todo =
    overdue.length + d.homework_to_review + d.quizzes_to_review + (d.debtors.length > 0 ? 1 : 0);

  return (
    <Layout>
      <div className="space-y-7">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{dayLong(d.date)}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <QuickAction
            icon={CalendarPlus}
            label="Нове заняття"
            onClick={() => setDialog("lesson")}
          />
          <QuickAction icon={Wallet} label="Записати оплату" onClick={() => setDialog("payment")} />
          <QuickAction
            icon={ClipboardPlus}
            label="Задати ДЗ"
            onClick={() => setDialog("homework")}
          />
          <QuickAction icon={UserPlus} label="Додати учня" onClick={() => setDialog("student")} />
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-7">
            <Section
              title={`Заняття сьогодні${d.today.length ? ` · ${d.today.length}` : ""}`}
              action={
                <button
                  onClick={() => navigate("/lessons")}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Розклад
                </button>
              }
            >
              {d.today.length === 0 ? (
                <div className={`${CARD} px-4 py-6 text-center text-sm text-muted-foreground`}>
                  Сьогодні занять немає.
                </div>
              ) : (
                <ol className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
                  {d.today.map((lesson) => {
                    const { minutes } = lessonClock(lesson);
                    return (
                      <li
                        key={lesson.id}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/40"
                        onClick={() => setOpen(lesson)}
                      >
                        <div className="w-14 shrink-0">
                          <div className="font-semibold">{hhmm(minutes)}</div>
                          <div className="text-xs text-muted-foreground">
                            {lesson.duration_minutes} хв
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{lesson.student_full_name}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {lesson.topic ?? "Без теми"}
                          </div>
                        </div>
                        {needsMark(lesson) ? (
                          <MarkDoneButton lesson={lesson} onChanged={() => void reload()} />
                        ) : (
                          <LessonStatusBadge status={lesson.status} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>

            <Section title="Найближчі 7 днів">
              {d.upcoming.length === 0 ? (
                <div className={`${CARD} px-4 py-6 text-center text-sm text-muted-foreground`}>
                  Запланованих занять немає.
                </div>
              ) : (
                <ul className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
                  {d.upcoming.slice(0, 8).map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/40"
                      onClick={() => setOpen(lesson)}
                    >
                      <span className="w-28 shrink-0 text-muted-foreground">
                        {formatDate(lesson.starts_at).slice(0, 5)} ·{" "}
                        {hhmm(lessonClock(lesson).minutes)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {lesson.student_full_name}
                      </span>
                      <span className="hidden truncate text-muted-foreground sm:block">
                        {lesson.topic}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="space-y-7">
            <Section title={todo ? "Потребує уваги" : "Усе під контролем"}>
              {todo === 0 ? (
                <div
                  className={`${CARD} flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground`}
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Немає нічого, що чекає на вас.
                </div>
              ) : (
                <div className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
                  {overdue.length > 0 && (
                    <TodoRow
                      icon={AlertCircle}
                      tone="bg-[#FFF1E6] text-orange-600"
                      text={
                        <>
                          Відмітити{" "}
                          <b>
                            {plural(overdue.length, [
                              "минуле заняття",
                              "минулі заняття",
                              "минулих занять",
                            ])}
                          </b>
                        </>
                      }
                      onClick={() => navigate("/lessons")}
                    />
                  )}
                  {d.homework_to_review > 0 && (
                    <TodoRow
                      icon={ClipboardCheck}
                      tone="bg-[#EEEBFF] text-primary"
                      text={
                        <>
                          Перевірити <b>{plural(d.homework_to_review, ["ДЗ", "ДЗ", "ДЗ"])}</b>
                        </>
                      }
                      onClick={() => navigate("/homework")}
                    />
                  )}
                  {d.quizzes_to_review > 0 && (
                    <TodoRow
                      icon={ListChecks}
                      tone="bg-[#E8F1FF] text-blue-600"
                      text={
                        <>
                          Перевірити{" "}
                          <b>{plural(d.quizzes_to_review, ["тест", "тести", "тестів"])}</b>
                        </>
                      }
                      onClick={() => navigate("/quizzes")}
                    />
                  )}
                  {d.debtors.length > 0 && (
                    <TodoRow
                      icon={Wallet}
                      tone="bg-[#FFF1E6] text-orange-600"
                      text={
                        <>
                          <b>
                            {plural(d.debtors.length, ["учень має", "учні мають", "учнів мають"])}
                          </b>{" "}
                          борг
                        </>
                      }
                      onClick={() => navigate("/payments")}
                    />
                  )}
                </div>
              )}
            </Section>

            <Section title="Гроші">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <button
                  onClick={() => navigate("/payments")}
                  className={`${CARD} p-4 text-left hover:bg-accent/30`}
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Отримано цього місяця
                  </span>
                  <span className="mt-1 block text-xl font-bold">
                    {formatMoney(d.income_month)}
                  </span>
                </button>
                <button
                  onClick={() => navigate("/payments")}
                  className={`${CARD} p-4 text-left hover:bg-accent/30`}
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Борги учнів
                  </span>
                  <span
                    className={`mt-1 block text-xl font-bold ${d.debt_total ? "text-destructive" : ""}`}
                  >
                    {formatMoney(d.debt_total)}
                  </span>
                </button>
              </div>
              {d.debtors.length > 0 && (
                <ul className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
                  {d.debtors.slice(0, 5).map((debtor) => (
                    <li key={debtor.student_id}>
                      <button
                        onClick={() => navigate(`/payments/students/${debtor.student_id}`)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/40"
                      >
                        <span className="truncate">{debtor.full_name}</span>
                        <span className="font-semibold text-destructive">
                          {formatMoney(-debtor.balance)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>

      {dialog === "lesson" && <LessonForm open onClose={close} onSaved={saved} />}
      {dialog === "payment" && <PaymentForm open onClose={close} onSaved={saved} />}
      {dialog === "student" && <StudentForm open onClose={close} onSaved={saved} />}
      {dialog === "homework" && <HomeworkAssignmentDialog open onClose={close} onCreated={saved} />}
      {open && (
        <LessonDialog
          lesson={open}
          onClose={() => setOpen(null)}
          onChanged={() => void reload()}
          onEdit={(lesson) => {
            setOpen(null);
            setEditing(lesson);
          }}
        />
      )}
      {editing && (
        <LessonForm
          open
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </Layout>
  );
}
