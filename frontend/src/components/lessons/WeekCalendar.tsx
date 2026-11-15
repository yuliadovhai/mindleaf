import type { Lesson, LessonStatus } from "../../api/types";
import { addDays } from "../../lib/datetime";
import { CARD } from "../../lib/labels";
import { STATUS_LABEL } from "../LessonStatusBadge";
import { dayMonth, hhmm, lessonClock, needsMark, weekdayShort } from "./lessonTime";
import { AlertCircle, Plus } from "lucide-react";

const HOUR_PX = 56;
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 21; // the grid ends at 21:00

const BLOCK_STYLE: Record<LessonStatus, string> = {
  planned: "border-[#6D5DF6] bg-[#EEEBFF] text-[#3F35A8]",
  done: "border-emerald-500 bg-[#E6F8EF] text-emerald-800",
  missed: "border-orange-400 bg-[#FFF1E6] text-orange-800",
  cancelled: "border-border bg-muted text-muted-foreground line-through",
};

interface WeekCalendarProps {
  /** Monday, "YYYY-MM-DD". */
  start: string;
  today: string;
  lessons: Lesson[];
  onLesson: (lesson: Lesson) => void;
  /** An empty slot was clicked: "YYYY-MM-DDTHH:MM". */
  onSlot: (startsAt: string) => void;
}

function byDay(start: string, lessons: Lesson[]) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const map = new Map<string, { lesson: Lesson; minutes: number }[]>(days.map((d) => [d, []]));
  for (const lesson of lessons) {
    const { date, minutes } = lessonClock(lesson);
    map.get(date)?.push({ lesson, minutes });
  }
  for (const list of map.values()) list.sort((a, b) => a.minutes - b.minutes);
  return { days, map };
}

/** Laptop: a time grid. Phone: the same week as a list of days. */
export function WeekCalendar(props: WeekCalendarProps) {
  return (
    <>
      <div className="hidden md:block">
        <TimeGrid {...props} />
      </div>
      <div className="md:hidden">
        <DayList {...props} />
      </div>
    </>
  );
}

function TimeGrid({ start, today, lessons, onLesson, onSlot }: WeekCalendarProps) {
  const { days, map } = byDay(start, lessons);

  // Stretch the grid when a lesson falls outside 8:00–21:00.
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  for (const list of map.values()) {
    for (const { lesson, minutes } of list) {
      first = Math.min(first, Math.floor(minutes / 60));
      last = Math.max(last, Math.ceil((minutes + lesson.duration_minutes) / 60));
    }
  }
  const hours = Array.from({ length: last - first }, (_, i) => first + i);

  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* Day headers */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border bg-[#F7F6FE]">
        <div />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div key={day} className="px-2 py-2.5 text-center">
              <div className="text-xs uppercase text-muted-foreground">{weekdayShort(day)}</div>
              <div
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? "bg-primary text-white" : ""
                }`}
              >
                {Number(day.slice(8))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-h-[calc(100vh-260px)] min-h-[420px] overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          {/* Time axis */}
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="-translate-y-2 pr-2 text-right text-xs text-muted-foreground"
              >
                {h > first && hhmm(h * 60)}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              className={`relative border-l border-border ${day === today ? "bg-accent/30" : ""}`}
            >
              {hours.map((h) => (
                <button
                  key={h}
                  style={{ height: HOUR_PX }}
                  onClick={() => onSlot(`${day}T${hhmm(h * 60)}`)}
                  aria-label={`Нове заняття ${dayMonth(day)} о ${hhmm(h * 60)}`}
                  className="group flex w-full items-start justify-center border-b border-border/60 pt-1 hover:bg-accent/50"
                >
                  <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-60" />
                </button>
              ))}

              {map.get(day)!.map(({ lesson, minutes }) => {
                const top = ((minutes - first * 60) / 60) * HOUR_PX;
                const height = Math.max((lesson.duration_minutes / 60) * HOUR_PX - 3, 22);
                const mark = needsMark(lesson);
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onLesson(lesson)}
                    style={{ top: top + 1, height }}
                    title={`${lesson.student_full_name} · ${STATUS_LABEL[lesson.status]}`}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-xs shadow-sm transition-transform hover:z-10 hover:scale-[1.02] ${
                      BLOCK_STYLE[lesson.status]
                    } ${mark ? "ring-2 ring-orange-300" : ""}`}
                  >
                    <div className="flex items-center gap-1 font-semibold">
                      {mark && <AlertCircle className="h-3 w-3 shrink-0 text-orange-500" />}
                      <span className="truncate">{lesson.student_full_name}</span>
                    </div>
                    {height > 34 && (
                      <div className="truncate opacity-80">
                        {hhmm(minutes)} {lesson.topic ? `· ${lesson.topic}` : ""}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayList({ start, today, lessons, onLesson, onSlot }: WeekCalendarProps) {
  const { days, map } = byDay(start, lessons);
  return (
    <div className="space-y-3">
      {days.map((day) => {
        const list = map.get(day)!;
        const isToday = day === today;
        return (
          <section key={day} className={`${CARD} p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isToday ? "bg-primary text-white" : "bg-muted"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                <span className="capitalize">{weekdayShort(day)}</span>
                {isToday && <span className="text-xs font-normal text-primary">сьогодні</span>}
              </h3>
              <button
                onClick={() => onSlot(`${day}T${list.length ? "18:00" : "16:00"}`)}
                className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Заняття
              </button>
            </div>
            {list.length === 0 ? (
              <p className="px-1 pb-1 text-sm text-muted-foreground">Вільний день</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map(({ lesson, minutes }) => (
                  <li key={lesson.id}>
                    <button
                      onClick={() => onLesson(lesson)}
                      className={`flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-left ${
                        BLOCK_STYLE[lesson.status]
                      }`}
                    >
                      <span className="w-11 shrink-0 text-sm font-semibold no-underline">
                        {hhmm(minutes)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {lesson.student_full_name}
                        </span>
                        <span className="block truncate text-xs opacity-80">
                          {lesson.duration_minutes} хв
                          {lesson.topic ? ` · ${lesson.topic}` : ""}
                        </span>
                      </span>
                      {needsMark(lesson) && (
                        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                          Відмітити
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
