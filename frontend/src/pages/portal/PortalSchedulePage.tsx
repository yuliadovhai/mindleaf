import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listMyLessons } from "../../api/portal";
import type { PortalLesson } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PortalLessonRow } from "../../components/PortalLessonRow";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { WeekCalendar } from "../../components/lessons/WeekCalendar";
import { weekLabel, weekStart } from "../../components/lessons/lessonTime";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { addDays, localInputToIso, todayKyiv } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { CalendarRange, ChevronLeft, ChevronRight, List } from "lucide-react";

const DAY = 24 * 3600 * 1000;

type View = "week" | "list";
const VIEW_KEY = "tutor-cabinet.portal-schedule-view";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "week" ? "week" : "list";
  } catch {
    return "list";
  }
}

export function PortalSchedulePage() {
  const { token } = useSession();
  const today = todayKyiv();
  const [view, setView] = useState<View>(savedView);
  const [week, setWeek] = useState(() => weekStart(today));
  const [openId, setOpenId] = useState<string | null>(null);

  const switchView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const load = useCallback(() => {
    if (view === "week") {
      return listMyLessons(token, {
        from: localInputToIso(`${week}T00:00`),
        to: localInputToIso(`${addDays(week, 7)}T00:00`),
      });
    }
    const now = Date.now();
    return listMyLessons(token, {
      from: new Date(now - 30 * DAY).toISOString(),
      to: new Date(now + 60 * DAY).toISOString(),
    });
  }, [token, view, week]);
  const { data, setData, loading, error } = useLoad(load);

  const replace = (changed: PortalLesson) =>
    setData((data ?? []).map((l) => (l.id === changed.id ? changed : l)));

  const lessons = data ?? [];
  const now = new Date().toISOString();
  const upcoming = lessons.filter((l) => l.starts_at >= now);
  const past = lessons.filter((l) => l.starts_at < now).reverse();
  const many = new Set(lessons.map((l) => l.student_id)).size > 1;
  const opened = lessons.find((l) => l.id === openId) ?? null;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Розклад</h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs
            value={view}
            onChange={switchView}
            items={[
              { value: "list", label: "Список", icon: List },
              { value: "week", label: "Тиждень", icon: CalendarRange },
            ]}
          />
          {view === "week" && (
            <div className="flex items-center gap-2">
              <span className="mr-1 text-sm font-medium">{weekLabel(week, addDays(week, 6))}</span>
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
          )}
        </div>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <LoadingSpinner />
        ) : view === "week" ? (
          <WeekCalendar
            start={week}
            today={today}
            lessons={lessons}
            onLesson={(l) => setOpenId(l.id)}
            blockTitle={(l) => (many ? l.student_full_name : (l.topic ?? "Заняття"))}
            showMarks={false}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {opened && (
        <Dialog open onOpenChange={(open) => !open && setOpenId(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="pr-6">{opened.topic ?? "Заняття"}</DialogTitle>
              <DialogDescription>
                {opened.student_full_name}
                {opened.tutor_name ? ` · репетитор ${opened.tutor_name}` : ""}
              </DialogDescription>
            </DialogHeader>
            <PortalLessonRow lesson={opened} showStudent={false} onChanged={replace} />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
