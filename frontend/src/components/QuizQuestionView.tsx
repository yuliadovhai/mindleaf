import type { AssignmentQuestion, GradedBy } from "../api/types";
import { Badge } from "./ui/badge";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

const GRADED_BY: Record<GradedBy, string> = {
  auto: "автоматично",
  ai: "ШІ",
  tutor: "репетитор",
};

/** A submitted question: the answer, what was correct, points and feedback. */
export function QuizQuestionView({
  question,
  index,
  showReference = false,
}: {
  question: AssignmentQuestion;
  index: number;
  showReference?: boolean;
}) {
  const answer = question.answer;
  const selected = new Set(answer?.selected_options ?? []);
  const correct = new Set(question.correct_options ?? []);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {index + 1}. {question.prompt}
        </p>
        <span className="shrink-0 text-sm">
          {answer?.points ?? "—"} / {question.points}
        </span>
      </div>

      {question.options && (
        <ul className="space-y-1">
          {question.options.map((o) => {
            const isSelected = selected.has(o.id);
            const isCorrect = correct.has(o.id);
            const Icon = isCorrect ? CheckCircle2 : isSelected ? XCircle : Circle;
            const color = isCorrect
              ? "text-green-700"
              : isSelected
                ? "text-destructive"
                : "text-muted-foreground";
            return (
              <li key={o.id} className={`flex items-center gap-2 text-sm ${color}`}>
                <Icon className="h-4 w-4" />
                <span className={isSelected ? "font-medium" : ""}>{o.text}</span>
                {isSelected && <span className="text-xs">(обрано)</span>}
              </li>
            );
          })}
        </ul>
      )}

      {question.kind === "text" && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
            {answer?.text_answer ?? <span className="text-muted-foreground">Без відповіді</span>}
          </p>
          {showReference && question.reference_answer && (
            <p className="text-sm text-muted-foreground">Еталон: {question.reference_answer}</p>
          )}
        </div>
      )}

      {answer?.feedback && <p className="text-sm italic">«{answer.feedback}»</p>}
      {answer?.graded_by && <Badge variant="outline">Оцінено: {GRADED_BY[answer.graded_by]}</Badge>}
      {answer && answer.points === null && <Badge variant="secondary">Ще перевіряється</Badge>}
    </div>
  );
}
