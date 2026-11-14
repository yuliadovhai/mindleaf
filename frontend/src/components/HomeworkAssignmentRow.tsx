import { useSession } from "../auth/session";
import { deleteHomeworkAssignment } from "../api/homework";
import type { HomeworkAssignment } from "../api/types";
import { formatDateTime } from "../lib/datetime";
import { CARD } from "../lib/labels";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Paperclip, Trash2 } from "lucide-react";

/** One homework assignment in the tutor's lists, with its answer status. */
export function HomeworkAssignmentRow({
  assignment: a,
  showStudent = true,
  onDeleted,
}: {
  assignment: HomeworkAssignment;
  showStudent?: boolean;
  onDeleted: () => void;
}) {
  const { token } = useSession();
  const overdue = a.due_at && !a.submission_status && a.due_at < new Date().toISOString();

  return (
    <div className={`${CARD} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}>
      <span>
        <span className="block font-medium">
          {a.title}
          {showStudent && ` — ${a.student_full_name}`}
        </span>
        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className={overdue ? "text-destructive font-medium" : ""}>
            {a.due_at ? `Здати до ${formatDateTime(a.due_at)}` : "Без строку"}
          </span>
          {a.materials.length > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {a.materials.map((m) => m.title).join(", ")}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {a.submission_status === null && <Badge variant="warning">Не здано</Badge>}
        {a.submission_status === "submitted" && <Badge variant="secondary">Здано</Badge>}
        {a.submission_status === "reviewed" && (
          <Badge variant="success">Перевірено{a.grade !== null ? ` · ${a.grade}/12` : ""}</Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Видалити"
          onClick={async () => {
            if (!window.confirm(`Видалити «${a.title}» разом із відповіддю?`)) return;
            await deleteHomeworkAssignment(token, a.id);
            onDeleted();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </span>
    </div>
  );
}
