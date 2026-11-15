import { useState } from "react";
import { useSession } from "../../auth/session";
import { updateLessonStatus } from "../../api/lessons";
import type { Lesson } from "../../api/types";
import { formatMoney } from "../../lib/money";
import { formatDate } from "../../lib/datetime";
import { errorText } from "../../lib/errors";
import { CARD } from "../../lib/labels";
import { LessonStatusBadge } from "../LessonStatusBadge";
import { Button } from "../ui/button";
import { hhmm, lessonClock, needsMark } from "./lessonTime";
import { Check, ChevronRight } from "lucide-react";

interface LessonListProps {
  lessons: Lesson[];
  onOpen: (lesson: Lesson) => void;
  onChanged: () => void;
  /** Hide the student column (on a student's own page). */
  hideStudent?: boolean;
}

/** One-tap "Проведено" for a lesson that already happened. */
export function MarkDoneButton({
  lesson,
  onChanged,
  size = "sm",
}: {
  lesson: Lesson;
  onChanged: () => void;
  size?: "sm" | "default";
}) {
  const { token } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      className="gap-1.5"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await updateLessonStatus(token, lesson.id, { status: "done" });
          onChanged();
        } catch (err) {
          alert(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Check className="h-4 w-4" />
      Проведено
    </Button>
  );
}

/** Lessons as rows: a table on a laptop, cards on a phone. A row opens the lesson. */
export function LessonList({ lessons, onOpen, onChanged, hideStudent }: LessonListProps) {
  return (
    <div className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
      {lessons.map((lesson) => {
        const { minutes } = lessonClock(lesson);
        return (
          <div
            key={lesson.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(lesson)}
            onKeyDown={(e) => e.key === "Enter" && onOpen(lesson)}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
          >
            <div className="w-[88px] shrink-0">
              <div className="text-sm font-semibold">{hhmm(minutes)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(lesson.starts_at)}</div>
            </div>
            <div className="min-w-0 flex-1">
              {!hideStudent && (
                <div className="truncate font-medium">{lesson.student_full_name}</div>
              )}
              <div className="truncate text-sm text-muted-foreground">
                {lesson.topic ?? "Без теми"}
                <span className="hidden sm:inline">
                  {" "}
                  · {lesson.duration_minutes} хв · {formatMoney(lesson.price)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {needsMark(lesson) ? (
                <MarkDoneButton lesson={lesson} onChanged={onChanged} />
              ) : (
                <LessonStatusBadge status={lesson.status} />
              )}
              <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
