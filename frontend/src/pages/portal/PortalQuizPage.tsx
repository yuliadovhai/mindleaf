import { useCallback, useEffect, useState } from "react";
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
import { formatWhenInline } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { plural } from "../../lib/plural";
import { ArrowLeft, Check, CheckCircle2, Clock } from "lucide-react";

type Draft = Record<string, { selected: string[]; text: string }>;

const draftKey = (id: string) => `mindleaf.quiz-draft.${id}`;

/** Answers in progress survive a reload or a closed tab (this browser only). */
function loadDraft(id: string): Draft {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}") as Draft;
  } catch {
    return {};
  }
}

function verdict(percent: number): string {
  if (percent >= 90) return "Чудовий результат!";
  if (percent >= 70) return "Добре вийшло.";
  if (percent >= 50) return "Непогано, але є що повторити.";
  return "Варто повторити тему й спробувати ще.";
}

function barColor(percent: number): string {
  if (percent < 50) return "bg-destructive";
  if (percent < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function PortalQuizPage({ id }: { id: string }) {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const load = useCallback(() => getMyAssignment(token, id), [token, id]);
  const { data, setData, loading, error } = useLoad(load);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(id));
  useEffect(() => {
    try {
      if (Object.keys(draft).length) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    } catch {
      // Private mode: the draft just isn't kept.
    }
  }, [draft, id]);
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

  const isAnswered = (qid: string, kind: string) => {
    const e = entry(qid);
    return kind === "text" ? Boolean(e.text.trim()) : e.selected.length > 0;
  };
  const answered = data.questions.filter((q) => isAnswered(q.id, q.kind)).length;
  const total = data.questions.length;
  const totalPoints = data.questions.reduce((sum, q) => sum + q.points, 0);
  const pending = data.questions.filter((q) => q.answer && q.answer.points === null).length;
  // While written answers wait for a grade, count what is already graded.
  const earned = data.score ?? data.questions.reduce((sum, q) => sum + (q.answer?.points ?? 0), 0);
  const percent = data.max_score > 0 ? Math.round((earned / data.max_score) * 100) : null;

  const submit = async () => {
    const unanswered = total - answered;
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
      try {
        localStorage.removeItem(draftKey(id));
      } catch {
        // nothing to clean up
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setFormError(detail === "already_submitted" ? "Тест уже здано." : "Не вдалося здати тест");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout width="narrow">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/quizzes")}>
          <ArrowLeft className="h-4 w-4" />
          Усі тести
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">{data.quiz_title}</h1>
            <p className="text-sm text-muted-foreground">
              {data.student_full_name}
              {data.due_at ? ` · пройти до ${formatWhenInline(data.due_at)}` : ""}
            </p>
          </div>
          <AssignmentStatusBadge status={data.status} />
        </div>

        {taking && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-2xl bg-accent/60 px-4 py-3 text-sm">
            <span>{plural(total, ["питання", "питання", "питань"])}</span>
            <span>{plural(totalPoints, ["бал", "бали", "балів"])}</span>
            <span className="text-muted-foreground">
              Відповіді зберігаються, поки ви не здасте тест.
            </span>
          </div>
        )}

        {!taking && data.status !== "assigned" && percent !== null && (
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-5 shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums">
                {earned}
                <span className="text-lg font-normal text-muted-foreground">/{data.max_score}</span>
              </p>
              <p className="text-xs text-muted-foreground">{percent}%</p>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium">
                {pending > 0 ? "Попередній результат" : verdict(percent)}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${barColor(percent)}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {pending > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Ще{" "}
                  {plural(pending, [
                    "відповідь чекає",
                    "відповіді чекають",
                    "відповідей чекають",
                  ])}{" "}
                  на оцінку — бал може зрости.
                </p>
              )}
            </div>
          </div>
        )}

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
                className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isAnswered(q.id, q.kind)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAnswered(q.id, q.kind) ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <p className="flex-1 pt-0.5 font-medium">{q.prompt}</p>
                  <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">
                    {plural(q.points, ["бал", "бали", "балів"])}
                  </span>
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
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                            checked
                              ? "border-primary bg-accent font-medium"
                              : "border-border hover:border-primary/40 hover:bg-accent/40"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                              q.kind === "single" ? "rounded-full" : "rounded-md"
                            } ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                          >
                            {checked &&
                              (q.kind === "single" ? (
                                <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              ))}
                          </span>
                          <input
                            className="sr-only"
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
          <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl border border-border bg-card/95 p-4 shadow-[0_8px_30px_rgba(109,93,246,0.15)] backdrop-blur md:bottom-4">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm">
                  {answered === total ? (
                    <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Відповіли на всі питання
                    </span>
                  ) : (
                    <>
                      Відповіли на <span className="font-medium">{answered}</span> з {total}
                    </>
                  )}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <Button disabled={saving} onClick={() => void submit()}>
                {saving ? "Надсилаю…" : "Здати тест"}
              </Button>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}
