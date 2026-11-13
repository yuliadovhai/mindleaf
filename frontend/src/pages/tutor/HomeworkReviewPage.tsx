import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listHomework, reviewHomework } from "../../api/homework";
import type { Homework, SubmissionStatus } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";

function ReviewForm({ item, onSaved }: { item: Homework; onSaved: (h: Homework) => void }) {
  const { token } = useSession();
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [grade, setGrade] = useState<string>(item.grade ? String(item.grade) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(
        await reviewHomework(token, item.id, {
          feedback: feedback.trim() || null,
          grade: grade ? Number(grade) : null,
        })
      );
    } catch {
      setError("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <div className="space-y-1">
        <Label htmlFor={`fb-${item.id}`}>Відгук</Label>
        <Textarea
          id={`fb-${item.id}`}
          rows={2}
          maxLength={2000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`gr-${item.id}`}>Оцінка (1–12)</Label>
          <select
            id={`gr-${item.id}`}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">без оцінки</option>
            {Array.from({ length: 12 }, (_, i) => 12 - i).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={saving || (!feedback.trim() && !grade)} onClick={() => void save()}>
          {saving ? "Збереження…" : "Перевірено"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function HomeworkReviewPage() {
  const { token } = useSession();
  const [tab, setTab] = useState<SubmissionStatus>("submitted");
  const load = useCallback(() => listHomework(token, tab), [token, tab]);
  const { data, setData, loading, error } = useLoad(load);

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Домашні завдання</h1>
        <div className="flex gap-2">
          <Button
            variant={tab === "submitted" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("submitted")}
          >
            На перевірку
          </Button>
          <Button
            variant={tab === "reviewed" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("reviewed")}
          >
            Перевірені
          </Button>
        </div>
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {tab === "submitted" ? "Нічого не чекає на перевірку." : "Перевірених ще немає."}
          </p>
        )}
        {!loading &&
          data?.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{item.student_full_name}</span>
                <span className="text-sm text-muted-foreground">
                  Заняття {formatDateTime(item.lesson_starts_at)} · здано{" "}
                  {formatDateTime(item.submitted_at)}
                </span>
              </div>
              {item.task && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Завдання: </span>
                  {item.task}
                </p>
              )}
              {item.text && <p className="whitespace-pre-wrap">{item.text}</p>}
              {item.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.photos.map((p) => (
                    <a key={p.key} href={p.url} target="_blank" rel="noreferrer">
                      <img
                        src={p.url}
                        alt="Фото відповіді"
                        className="h-24 w-24 rounded-md border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {item.status === "reviewed" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="success">
                    Перевірено{item.grade !== null ? ` · ${item.grade}/12` : ""}
                  </Badge>
                  {item.feedback && <span className="italic">«{item.feedback}»</span>}
                </div>
              )}
              {item.status === "submitted" && (
                <ReviewForm
                  item={item}
                  onSaved={(saved) => setData((data ?? []).filter((h) => h.id !== saved.id))}
                />
              )}
            </div>
          ))}
      </div>
    </Layout>
  );
}
