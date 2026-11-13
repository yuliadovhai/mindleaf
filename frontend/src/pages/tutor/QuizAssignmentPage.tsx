import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { getAssignment, gradeAnswer } from "../../api/quizzes";
import type { AssignmentDetail, AssignmentQuestion } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { QuizQuestionView } from "../../components/QuizQuestionView";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ArrowLeft } from "lucide-react";

function GradeForm({
  assignmentId,
  question,
  onSaved,
}: {
  assignmentId: string;
  question: AssignmentQuestion;
  onSaved: (a: AssignmentDetail) => void;
}) {
  const { token } = useSession();
  const [points, setPoints] = useState(String(question.answer?.points ?? ""));
  const [feedback, setFeedback] = useState(question.answer?.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(
        await gradeAnswer(token, assignmentId, question.id, {
          points: Number(points),
          feedback: feedback.trim() || null,
        })
      );
    } catch {
      setError(`Бали мають бути від 0 до ${question.points}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
      <Input
        type="number"
        min={0}
        max={question.points}
        className="h-9 w-20"
        aria-label="Бали"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">/ {question.points}</span>
      <Input
        className="h-9 flex-1 min-w-48"
        placeholder="Відгук (необов'язково)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <Button size="sm" disabled={saving || points === ""} onClick={() => void save()}>
        {question.answer?.points === null ? "Оцінити" : "Змінити бали"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function QuizAssignmentPage({ id }: { id: string }) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const load = useCallback(() => getAssignment(token, id), [token, id]);
  const { data, setData, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error || !data)
    return (
      <Layout>
        <ErrorMessage message={error || "Не знайдено"} />
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/quizzes")}>
          <ArrowLeft className="h-4 w-4" />
          Усі тести
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">{data.quiz_title}</h1>
            <p className="text-sm text-muted-foreground">
              {data.student_full_name}
              {data.submitted_at ? ` · здано ${formatDateTime(data.submitted_at)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data.score !== null && (
              <span className="text-xl font-bold">
                {data.score} / {data.max_score}
              </span>
            )}
            <AssignmentStatusBadge status={data.status} />
          </div>
        </div>
        {data.status === "assigned" ? (
          <p className="text-sm text-muted-foreground">Учень ще не пройшов тест.</p>
        ) : (
          data.questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <QuizQuestionView question={q} index={i} showReference />
              <GradeForm assignmentId={data.id} question={q} onSaved={setData} />
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
