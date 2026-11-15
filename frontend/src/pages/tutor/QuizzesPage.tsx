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
import { CheckCircle2, FileText, Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { LearningHeader } from "../../components/LearningHeader";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { EmptyState } from "../../components/common/EmptyState";
import { plural } from "../../lib/plural";

type Tab = "review" | "assigned" | "quizzes";

export function QuizzesPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assigning, setAssigning] = useState<QuizSummary | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

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

  const review = data?.assignments.filter((a) => a.status === "needs_review") ?? [];
  const current: Tab = tab ?? (review.length > 0 ? "review" : "quizzes");
  const shown = current === "review" ? review : (data?.assignments ?? []);

  return (
    <Layout>
      <div className="space-y-5">
        <LearningHeader
          section="quizzes"
          actions={
            <>
              <Button variant="outline" className="gap-1.5" onClick={() => navigate("/materials")}>
                <Sparkles className="h-4 w-4" />З матеріалу (ШІ)
              </Button>
              <Button className="gap-1.5" onClick={() => setBuilderOpen(true)}>
                <Plus className="h-4 w-4" />
                Новий тест
              </Button>
            </>
          }
        />
        <SegmentedTabs
          value={current}
          onChange={setTab}
          items={[
            { value: "review", label: "Перевірити", count: review.length },
            { value: "assigned", label: "Призначені" },
            { value: "quizzes", label: "Мої тести" },
          ]}
        />
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}

        {data && current === "quizzes" && (
          <section className="space-y-2">
            {data.quizzes.length === 0 && (
              <EmptyState
                icon={FileText}
                text="Тестів ще немає. Створіть вручну або згенеруйте з матеріалу."
              />
            )}
            {data.quizzes.map((q) => {
              const draft = q.status === "draft";
              const editable = q.assignment_count === 0;
              return (
                <div
                  key={q.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 shadow-[0_4px_20px_rgba(109,93,246,0.06)] ${draft ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}
                >
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      {draft ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      {q.title}
                      {draft && <Badge variant="warning">чернетка</Badge>}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {plural(q.question_count, ["питання", "питання", "питань"])} ·{" "}
                      {plural(q.max_score, ["бал", "бали", "балів"])}
                      {q.assignment_count > 0 &&
                        ` · призначено ${plural(q.assignment_count, ["раз", "рази", "разів"])}`}
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
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground"
                        aria-label="Видалити"
                        onClick={() => void remove(q)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Видалити</span>
                      </Button>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {data && current !== "quizzes" && (
          <section className="space-y-2">
            {shown.length === 0 && (
              <EmptyState
                icon={current === "review" ? CheckCircle2 : Send}
                text={
                  current === "review"
                    ? "Письмових відповідей на перевірку немає."
                    : "Ще нічого не призначено. Відкрийте «Мої тести» і натисніть «Призначити»."
                }
              />
            )}
            {shown.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/quiz-assignments/${a.id}`)}
                className="w-full flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left hover:bg-accent/40 transition-colors shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
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
        )}
      </div>
      <QuizBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={() => {
          setTab("quizzes");
          void reload();
        }}
      />
      <AssignQuizDialog
        quiz={assigning}
        onClose={() => setAssigning(null)}
        onAssigned={() => {
          setTab("assigned");
          void reload();
        }}
      />
    </Layout>
  );
}
