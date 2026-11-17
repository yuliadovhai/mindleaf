import { useState } from "react";
import { useSession } from "../../auth/session";
import { deleteLesson, updateLessonStatus } from "../../api/lessons";
import type { Lesson, LessonStatus } from "../../api/types";
import { formatMoney } from "../../lib/money";
import { errorText } from "../../lib/errors";
import { useRouter } from "../../lib/router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { LessonStatusBadge } from "../LessonStatusBadge";
import { dayLong, hhmm, lessonClock } from "./lessonTime";
import { Check, CircleSlash, Pencil, RotateCcw, Trash2, User, UserX, Video } from "lucide-react";

interface LessonDialogProps {
  lesson: Lesson;
  onClose: () => void;
  /** Called after any change, so the page can reload. */
  onChanged: () => void;
  onEdit: (lesson: Lesson) => void;
}

/** One lesson: details and the status actions as big, labelled buttons. */
export function LessonDialog({ lesson, onClose, onChanged, onEdit }: LessonDialogProps) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { date, minutes } = lessonClock(lesson);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: LessonStatus) =>
    run(() => updateLessonStatus(token, lesson.id, { status }));

  const remove = () => {
    if (
      !confirm("Видалити заняття назавжди? Якщо воно не відбулося, краще позначити «Скасовано».")
    ) {
      return;
    }
    void run(() => deleteLesson(token, lesson.id));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="pr-6">{lesson.student_full_name}</DialogTitle>
          <DialogDescription>
            {dayLong(date)}, {hhmm(minutes)}–{hhmm(minutes + lesson.duration_minutes)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <LessonStatusBadge status={lesson.status} />
            <span className="text-muted-foreground">
              {lesson.duration_minutes} хв · {formatMoney(lesson.price)}
            </span>
          </div>
          {lesson.topic && (
            <p>
              <span className="text-muted-foreground">Тема: </span>
              {lesson.topic}
            </p>
          )}
          {lesson.homework && (
            <p className="whitespace-pre-wrap">
              <span className="text-muted-foreground">ДЗ: </span>
              {lesson.homework}
            </p>
          )}
          {lesson.join_url && lesson.status === "planned" && (
            <a
              href={lesson.join_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 font-medium text-primary hover:underline"
            >
              <Video className="h-4 w-4 shrink-0" />
              <span className="truncate">Приєднатися до заняття</span>
            </a>
          )}
          {lesson.notes && (
            <p className="whitespace-pre-wrap rounded-xl bg-muted px-3 py-2 text-muted-foreground">
              {lesson.notes}
            </p>
          )}
          {lesson.cancelled_by_role === "parent" && (
            <p className="text-muted-foreground">Скасували батьки.</p>
          )}
        </div>

        {lesson.status === "planned" ? (
          <div className="grid gap-2">
            <Button
              size="lg"
              className="gap-2"
              disabled={busy}
              onClick={() => void setStatus("done")}
            >
              <Check className="h-5 w-5" />
              Заняття проведено
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void setStatus("missed")}
              >
                <UserX className="h-4 w-4" />
                Учень не прийшов
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void setStatus("cancelled")}
              >
                <CircleSlash className="h-4 w-4" />
                Скасувати
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void setStatus("planned")}
          >
            <RotateCcw className="h-4 w-4" />
            Повернути в «Заплановано»
          </Button>
        )}
        {lesson.status === "planned" && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Пропуск не списується з балансу. Щоб узяти за нього гроші, позначте «Проведено».
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-1 border-t border-border pt-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onEdit(lesson)}>
            <Pencil className="h-4 w-4" />
            Редагувати
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/students/${lesson.student_id}`)}
          >
            <User className="h-4 w-4" />
            Картка учня
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" />
            Видалити
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
