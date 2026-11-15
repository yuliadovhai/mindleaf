import { useCallback, useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { listLessons } from "../api/lessons";
import { listStudents } from "../api/students";
import type { Lesson, LessonStatus, Student } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { LessonForm } from "../components/LessonForm";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { SegmentedTabs } from "../components/common/SegmentedTabs";
import { WeekCalendar } from "../components/lessons/WeekCalendar";
import { LessonList } from "../components/lessons/LessonList";
import { LessonDialog } from "../components/lessons/LessonDialog";
import { weekLabel, weekStart } from "../components/lessons/lessonTime";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { addDays, localInputToIso, todayKyiv } from "../lib/datetime";
import { plural } from "../lib/plural";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";

type View = "week" | "list";
type Range = "upcoming" | "past" | "unmarked";

const VIEW_KEY = "tutor-cabinet.schedule-view";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "week";
  } catch {
    return "week";
  }
}

const RANGE_LABEL: Record<Range, string> = {
  upcoming: "Найближчі",
  unmarked: "Не відмічені",
  past: "Минулі",
};

const STATUS_OPTIONS: { value: LessonStatus | "all"; label: string }[] = [
  { value: "all", label: "Усі статуси" },
  { value: "planned", label: "Заплановано" },
  { value: "done", label: "Проведено" },
  { value: "cancelled", label: "Скасовано" },
  { value: "missed", label: "Пропуск" },
];

export function LessonsPage() {
  const { token } = useSession();
  const today = todayKyiv();

  const [view, setView] = useState<View>(savedView);
  const [week, setWeek] = useState(() => weekStart(today));
  const [range, setRange] = useState<Range>("upcoming");
  const [studentId, setStudentId] = useState("all");
  const [status, setStatus] = useState<LessonStatus | "all">("all");
  const [students, setStudents] = useState<Student[]>([]);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [unmarked, setUnmarked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [open, setOpen] = useState<Lesson | null>(null);
  const [form, setForm] = useState<{ initial?: Lesson; startsAt?: string } | null>(null);

  useEffect(() => {
    listStudents(token, false)
      .then(setStudents)
      .catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const now = new Date().toISOString();
    const filters: Parameters<typeof listLessons>[1] = {};
    if (view === "week") {
      filters.from = localInputToIso(`${week}T00:00`);
      filters.to = localInputToIso(`${addDays(week, 7)}T00:00`);
    } else {
      if (range === "upcoming") filters.from = now;
      if (range === "past") filters.to = now;
      if (range === "unmarked") {
        filters.to = now;
        filters.status = "planned";
      }
      if (studentId !== "all") filters.student_id = studentId;
      if (status !== "all" && range !== "unmarked") filters.status = status;
    }
    Promise.all([listLessons(token, filters), listLessons(token, { to: now, status: "planned" })])
      .then(([list, waiting]) => {
        // Past lists read best newest first; the API returns oldest first.
        setLessons(view === "list" && range !== "upcoming" ? [...list].reverse() : list);
        setUnmarked(waiting.length);
      })
      .catch(() => setError("Не вдалося завантажити заняття"))
      .finally(() => setLoading(false));
  }, [token, view, week, range, studentId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const switchView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // private mode: the choice just isn't remembered
    }
  };

  const weekEnd = addDays(week, 6);
  const weekDone = lessons.filter((l) => l.status === "done").length;
  const weekPlanned = lessons.filter((l) => l.status === "planned").length;

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="Розклад"
          subtitle={
            view === "week"
              ? "Натисніть на заняття, щоб відмітити його, або на вільний час — щоб додати нове."
              : "Усі заняття списком із фільтрами."
          }
          actions={
            <Button className="gap-1.5" onClick={() => setForm({})}>
              <Plus className="h-4 w-4" />
              Нове заняття
            </Button>
          }
        />

        {unmarked > 0 && !(view === "list" && range === "unmarked") && (
          <button
            onClick={() => {
              switchView("list");
              setRange("unmarked");
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-[#FFF8F1] px-4 py-3 text-left text-sm"
          >
            <span>
              <span className="font-semibold">
                {plural(unmarked, ["заняття чекає", "заняття чекають", "занять чекають"])}
              </span>{" "}
              на відмітку: баланс рахує лише проведені заняття.
            </span>
            <span className="flex shrink-0 items-center font-semibold text-orange-700">
              Відмітити
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs
            value={view}
            onChange={switchView}
            items={[
              { value: "week", label: "Тиждень", icon: CalendarRange },
              { value: "list", label: "Список", icon: List },
            ]}
          />

          {view === "week" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Попередній тиждень"
                onClick={() => setWeek(addDays(week, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={week === weekStart(today)}
                onClick={() => setWeek(weekStart(today))}
              >
                Цей тиждень
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Наступний тиждень"
                onClick={() => setWeek(addDays(week, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <SegmentedTabs
              value={range}
              onChange={setRange}
              items={(["upcoming", "unmarked", "past"] as Range[]).map((r) => ({
                value: r,
                label: RANGE_LABEL[r],
                count: r === "unmarked" ? unmarked : undefined,
              }))}
            />
          )}
        </div>

        {view === "week" ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{weekLabel(week, weekEnd)}</h2>
            {!loading && (
              <p className="text-sm text-muted-foreground">
                {plural(lessons.length, ["заняття", "заняття", "занять"])}
                {weekDone > 0 && ` · проведено ${weekDone}`}
                {weekPlanned > 0 && ` · заплановано ${weekPlanned}`}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="sm:w-52" aria-label="Учень">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі учні</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={range === "unmarked" ? "planned" : status}
              onValueChange={(v) => setStatus(v as LessonStatus | "all")}
              disabled={range === "unmarked"}
            >
              <SelectTrigger className="sm:w-44" aria-label="Статус">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error ? (
          <ErrorMessage message={error} />
        ) : loading && lessons.length === 0 ? (
          <LoadingSpinner />
        ) : view === "week" ? (
          <WeekCalendar
            start={week}
            today={today}
            lessons={lessons}
            onLesson={setOpen}
            onSlot={(startsAt) => setForm({ startsAt })}
          />
        ) : lessons.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            text={
              range === "unmarked"
                ? "Усі минулі заняття відмічені"
                : range === "upcoming"
                  ? "Запланованих занять немає"
                  : "Занять не знайдено"
            }
          />
        ) : (
          <LessonList lessons={lessons} onOpen={setOpen} onChanged={load} />
        )}
      </div>

      {open && (
        <LessonDialog
          lesson={open}
          onClose={() => setOpen(null)}
          onChanged={load}
          onEdit={(lesson) => {
            setOpen(null);
            setForm({ initial: lesson });
          }}
        />
      )}

      {form && (
        <LessonForm
          open
          initial={form.initial}
          defaultStartsAt={form.startsAt}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </Layout>
  );
}
