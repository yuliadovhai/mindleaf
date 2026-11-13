import { useState } from "react";
import type { PortalLesson } from "../api/types";
import { cancelLesson } from "../api/portal";
import { ApiError } from "../api/client";
import { useSession } from "../auth/session";
import { useRouter } from "../lib/router";
import { formatDateTime } from "../lib/datetime";
import { formatMoney } from "../lib/money";
import { LessonStatusBadge } from "./LessonStatusBadge";
import { Button } from "./ui/button";
import { BookOpen, XCircle } from "lucide-react";

const CANCEL_ERRORS: Record<string, string> = {
  cancel_too_late: "Уже пізно скасовувати — напишіть репетитору.",
  lesson_not_planned: "Це заняття вже не заплановане.",
};

interface Props {
  lesson: PortalLesson;
  showStudent: boolean;
  onChanged: (lesson: PortalLesson) => void;
}

/** One lesson as a student or a parent sees it, with the actions they may take. */
export function PortalLessonRow({ lesson, showStudent, onChanged }: Props) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    if (!window.confirm("Скасувати це заняття? Репетитор побачить, що його скасували батьки."))
      return;
    setBusy(true);
    setError("");
    try {
      onChanged(await cancelLesson(token, lesson.id));
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setError(CANCEL_ERRORS[detail] ?? "Не вдалося скасувати");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-mono text-muted-foreground">
            {formatDateTime(lesson.starts_at)}
          </span>
          {showStudent && <span className="font-medium">{lesson.student_full_name}</span>}
          {lesson.topic && <span className="text-sm">{lesson.topic}</span>}
          <span className="text-sm text-muted-foreground">{lesson.duration_minutes} хв</span>
        </div>
        <div className="flex items-center gap-2">
          {lesson.price !== null && (
            <span className="text-sm text-muted-foreground">{formatMoney(lesson.price)}</span>
          )}
          <LessonStatusBadge status={lesson.status} />
        </div>
      </div>
      {lesson.status === "cancelled" && lesson.cancelled_by_role && (
        <p className="text-xs text-muted-foreground">
          Скасував{lesson.cancelled_by_role === "parent" ? "и батьки" : " репетитор"}
        </p>
      )}
      {lesson.homework && (
        <p className="text-sm">
          <span className="text-muted-foreground">ДЗ: </span>
          {lesson.homework}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {lesson.homework && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/lessons/${lesson.id}/homework`)}
          >
            <BookOpen className="h-4 w-4" />
            Домашнє завдання
          </Button>
        )}
        {lesson.can_cancel && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            disabled={busy}
            onClick={() => void cancel()}
          >
            <XCircle className="h-4 w-4" />
            Скасувати
          </Button>
        )}
        {lesson.status === "planned" && !lesson.can_cancel && lesson.price !== null && (
          <span className="text-xs text-muted-foreground">
            Скасувати можна було до {formatDateTime(lesson.cancel_deadline)}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
