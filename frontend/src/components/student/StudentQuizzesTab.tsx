import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listAssignments } from "../../api/quizzes";
import { AssignmentStatusBadge } from "../AssignmentStatusBadge";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import { Button } from "../ui/button";
import { formatDateTime } from "../../lib/datetime";
import { CARD } from "../../lib/labels";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { StudentQuizDialog } from "./StudentQuizDialog";
import { Plus, Sparkles } from "lucide-react";

/** One student's quizzes: assign, see results, open written answers to check. */
export function StudentQuizzesTab({
  studentId,
  archived,
}: {
  studentId: string;
  archived: boolean;
}) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const load = useCallback(() => listAssignments(token, undefined, studentId), [token, studentId]);
  const { data, loading, error, reload } = useLoad(load);

  if (loading) return <LoadingSpinner />;
  const toCheck = data?.filter((a) => a.status === "needs_review") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate("/materials")}
        >
          <Sparkles className="h-4 w-4" />
          Згенерувати тест з матеріалу
        </Button>
        <Button className="gap-1.5" disabled={archived} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Призначити тест
        </Button>
      </div>
      {error && <ErrorMessage message={error} />}
      {toCheck.length > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
          Чекають на вашу перевірку письмових відповідей: {toCheck.length}. Відкрийте тест, щоб
          поставити бали.
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Тестів цьому учню ще не призначали.</p>
      )}
      {data?.map((a) => (
        <button
          key={a.id}
          onClick={() => navigate(`/quiz-assignments/${a.id}`)}
          className={`${CARD} w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40`}
        >
          <span>
            <span className="block font-medium">{a.quiz_title}</span>
            <span className="block text-xs text-muted-foreground">
              {a.submitted_at
                ? `Здано ${formatDateTime(a.submitted_at)}`
                : a.due_at
                  ? `Здати до ${formatDateTime(a.due_at)}`
                  : "Без строку"}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {a.score !== null && (
              <span className="text-sm font-medium">
                {a.score} / {a.max_score}
              </span>
            )}
            <AssignmentStatusBadge status={a.status} />
          </span>
        </button>
      ))}
      <StudentQuizDialog
        open={open}
        studentId={studentId}
        onClose={() => setOpen(false)}
        onAssigned={() => void reload()}
      />
    </div>
  );
}
