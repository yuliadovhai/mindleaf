import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { deleteQuiz, listAssignments, listQuizzes } from "../../api/quizzes";
import type { QuizSummary } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { QuizBuilderDialog } from "../../components/QuizBuilderDialog";
import { AssignQuizDialog } from "../../components/AssignQuizDialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { FileText, Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";

export function QuizzesPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assigning, setAssigning] = useState<QuizSummary | null>(null);

  const load = useCallback(async () => {
    const [quizzes, assignments] = await Promise.all([listQuizzes(token), listAssignments(token)]);
    return { quizzes, assignments };
  }, [token]);
  const { data, loading, error, reload } = useLoad(load);

  const remove = async (quiz: QuizSummary) => {
    if (!window.confirm(`Видалити тест «${quiz.title}»?`)) return;
    await deleteQuiz(token, quiz.id);
    await reload();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Тести</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => navigate("/materials")}>
              <Sparkles className="h-4 w-4" />З матеріалу (ШІ)
            </Button>
            <Button className="gap-1.5" onClick={() => setBuilderOpen(true)}>
              <Plus className="h-4 w-4" />
              Новий тест
            </Button>
          </div>
        </div>
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}

        {data && (
          <>
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Мої тести</h2>
              {data.quizzes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Тестів ще немає. Створіть вручну або згенеруйте з матеріалу.
                </p>
              )}
              {data.quizzes.map((q) => {
                const draft = q.status === "draft";
                const editable = q.assignment_count === 0;
                return (
                  <div
                    key={q.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${draft ? "border-amber-300 bg-amber-50" : "bg-card"}`}
                  >
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        {draft ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        {q.title}
                        {draft && <Badge variant="warning">чернетка</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {q.question_count} питань · {q.max_score} балів · призначено{" "}
                        {q.assignment_count} раз(и)
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {editable && (
                        <Button
                          size="sm"
                          variant={draft ? "default" : "outline"}
                          className="gap-1.5"
                          onClick={() => navigate(`/quizzes/${q.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                          {draft ? "Переглянути й опублікувати" : "Редагувати"}
                        </Button>
                      )}
                      {!draft && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setAssigning(q)}
                        >
                          <Send className="h-4 w-4" />
                          Призначити
                        </Button>
                      )}
                      {editable && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Видалити"
                          onClick={() => void remove(q)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </span>
                  </div>
                );
              })}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Призначені учням</h2>
              {data.assignments.length === 0 && (
                <p className="text-sm text-muted-foreground">Ще нічого не призначено.</p>
              )}
              {data.assignments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/quiz-assignments/${a.id}`)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50"
                >
                  <span>
                    <span className="block font-medium">
                      {a.quiz_title} — {a.student_full_name}
                    </span>
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
            </section>
          </>
        )}
      </div>
      <QuizBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={() => void reload()}
      />
      <AssignQuizDialog
        quiz={assigning}
        onClose={() => setAssigning(null)}
        onAssigned={() => void reload()}
      />
    </Layout>
  );
}
