import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listHomework, listHomeworkAssignments } from "../../api/homework";
import { HomeworkAssignmentDialog } from "../HomeworkAssignmentDialog";
import { HomeworkAssignmentRow } from "../HomeworkAssignmentRow";
import { SubmissionCard } from "../SubmissionCard";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import { Button } from "../ui/button";
import { useLoad } from "../../lib/useLoad";
import { Plus } from "lucide-react";

/** Everything about one student's homework: give it, see answers, check them. */
export function StudentHomeworkTab({
  studentId,
  archived,
}: {
  studentId: string;
  archived: boolean;
}) {
  const { token } = useSession();
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const [toReview, reviewed, assignments] = await Promise.all([
      listHomework(token, "submitted", studentId),
      listHomework(token, "reviewed", studentId),
      listHomeworkAssignments(token, studentId),
    ]);
    return { toReview, reviewed, assignments };
  }, [token, studentId]);
  const { data, loading, error, reload } = useLoad(load);

  if (loading) return <LoadingSpinner />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Окреме ДЗ з дедлайном і матеріалами. ДЗ до конкретного заняття задається в самому занятті.
        </p>
        <Button className="gap-1.5" disabled={archived} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Задати ДЗ
        </Button>
      </div>
      {error && <ErrorMessage message={error} />}

      <section className="space-y-2">
        <h3 className="font-semibold">
          На перевірку{data && data.toReview.length > 0 ? ` (${data.toReview.length})` : ""}
        </h3>
        {data?.toReview.length === 0 && (
          <p className="text-sm text-muted-foreground">Нічого не чекає на перевірку.</p>
        )}
        {data?.toReview.map((item) => (
          <SubmissionCard
            key={item.id}
            item={item}
            showStudent={false}
            onReviewed={() => void reload()}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Задані ДЗ</h3>
        {data?.assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">Окремих ДЗ ще не було.</p>
        )}
        {data?.assignments.map((a) => (
          <HomeworkAssignmentRow
            key={a.id}
            assignment={a}
            showStudent={false}
            onDeleted={() => void reload()}
          />
        ))}
      </section>

      {data && data.reviewed.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Перевірені відповіді</h3>
          {data.reviewed.map((item) => (
            <SubmissionCard
              key={item.id}
              item={item}
              showStudent={false}
              onReviewed={() => void reload()}
            />
          ))}
        </section>
      )}

      <HomeworkAssignmentDialog
        open={open}
        studentId={studentId}
        onClose={() => setOpen(false)}
        onCreated={() => void reload()}
      />
    </div>
  );
}
