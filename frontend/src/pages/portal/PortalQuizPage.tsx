import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import { getMyAssignment, submitAssignment } from "../../api/quizzes";
import type { AnswerIn } from "../../api/types";
import { ApiError } from "../../api/client";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { QuizQuestionView } from "../../components/QuizQuestionView";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ArrowLeft } from "lucide-react";

type Draft = Record<string, { selected: string[]; text: string }>;

export function PortalQuizPage({ id }: { id: string }) {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const load = useCallback(() => getMyAssignment(token, id), [token, id]);
  const { data, setData, loading, error } = useLoad(load);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  const taking = data.status === "assigned" && me.role === "student";
  const entry = (qid: string) => draft[qid] ?? { selected: [], text: "" };
  const set = (qid: string, value: { selected: string[]; text: string }) =>
    setDraft({ ...draft, [qid]: value });

  const submit = async () => {
    const unanswered = data.questions.filter((q) => {
      const e = entry(q.id);
      return q.kind === "text" ? !e.text.trim() : e.selected.length === 0;
    }).length;
    if (unanswered && !window.confirm(`Без відповіді: ${unanswered}. Здати все одно?`)) return;
    setSaving(true);
    setFormError("");
    try {
      const answers: AnswerIn[] = data.questions.map((q) =>
        q.kind === "text"
          ? { question_id: q.id, text_answer: entry(q.id).text.trim() || null }
          : { question_id: q.id, selected_options: entry(q.id).selected }
      );
      setData(await submitAssignment(token, id, answers));
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setFormError(detail === "already_submitted" ? "Тест уже здано." : "Не вдалося здати тест");
    } finally {
      setSaving(false);
    }
  };

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
              {data.due_at ? ` · здати до ${formatDateTime(data.due_at)}` : ""}
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

        {data.status === "submitted" && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            Варіанти вже перевірено. Письмові відповіді зараз перевіряє ШІ — оновіть сторінку за
            хвилину.
          </p>
        )}
        {data.status === "needs_review" && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            Письмові відповіді перевіряє репетитор.
          </p>
        )}
        {data.status === "assigned" && me.role === "parent" && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">Тест ще не пройдено.</p>
        )}

        {taking
          ? data.questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {i + 1}. {q.prompt}
                  </p>
                  <span className="shrink-0 text-sm text-muted-foreground">{q.points} б.</span>
                </div>
                {q.kind === "text" ? (
                  <Textarea
                    rows={4}
                    maxLength={2000}
                    placeholder="Ваша відповідь"
                    value={entry(q.id).text}
                    onChange={(e) => set(q.id, { ...entry(q.id), text: e.target.value })}
                  />
                ) : (
                  <div className="space-y-2">
                    {q.kind === "multiple" && (
                      <p className="text-xs text-muted-foreground">Можна обрати кілька</p>
                    )}
                    {q.options?.map((o) => {
                      const selected = entry(q.id).selected;
                      const checked = selected.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type={q.kind === "single" ? "radio" : "checkbox"}
                            name={q.id}
                            checked={checked}
                            onChange={() =>
                              set(q.id, {
                                ...entry(q.id),
                                selected:
                                  q.kind === "single"
                                    ? [o.id]
                                    : checked
                                      ? selected.filter((s) => s !== o.id)
                                      : [...selected, o.id],
                              })
                            }
                          />
                          {o.text}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          : data.status !== "assigned" &&
            data.questions.map((q, i) => <QuizQuestionView key={q.id} question={q} index={i} />)}

        {taking && (
          <div className="space-y-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button disabled={saving} onClick={() => void submit()}>
              {saving ? "Надсилаю…" : "Здати тест"}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
