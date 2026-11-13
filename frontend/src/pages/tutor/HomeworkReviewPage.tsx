import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import {
  deleteHomeworkAssignment,
  listHomework,
  listHomeworkAssignments,
  reviewHomework,
} from "../../api/homework";
import type { Homework } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { HomeworkAssignmentDialog } from "../../components/HomeworkAssignmentDialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { Paperclip, Plus, Trash2 } from "lucide-react";

type Tab = "submitted" | "reviewed" | "assignments";

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

function Submissions({ tab }: { tab: "submitted" | "reviewed" }) {
  const { token } = useSession();
  const load = useCallback(() => listHomework(token, tab), [token, tab]);
  const { data, setData, loading, error } = useLoad(load);

  if (loading) return <LoadingSpinner />;
  return (
    <div className="space-y-3">
      {error && <ErrorMessage message={error} />}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {tab === "submitted" ? "Нічого не чекає на перевірку." : "Перевірених ще немає."}
        </p>
      )}
      {data?.map((item) => (
        <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {item.student_full_name}
              {item.title && <span className="font-normal"> — {item.title}</span>}
            </span>
            <span className="text-sm text-muted-foreground">
              {item.lesson_starts_at
                ? `Заняття ${formatDateTime(item.lesson_starts_at)} · `
                : item.due_at
                  ? `Строк ${formatDateTime(item.due_at)} · `
                  : ""}
              здано {formatDateTime(item.submitted_at)}
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
  );
}

function Assignments() {
  const { token } = useSession();
  const [open, setOpen] = useState(false);
  const load = useCallback(() => listHomeworkAssignments(token), [token]);
  const { data, loading, error, reload } = useLoad(load);

  return (
    <div className="space-y-3">
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Задати ДЗ
      </Button>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Окремих завдань ще немає.</p>
      )}
      {data?.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
        >
          <span>
            <span className="block font-medium">
              {a.title} — {a.student_full_name}
            </span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {a.due_at ? `Здати до ${formatDateTime(a.due_at)}` : "Без строку"}
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
              <Badge variant="success">
                Перевірено{a.grade !== null ? ` · ${a.grade}/12` : ""}
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Видалити"
              onClick={async () => {
                if (!window.confirm(`Видалити «${a.title}» разом із відповіддю?`)) return;
                await deleteHomeworkAssignment(token, a.id);
                await reload();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </span>
        </div>
      ))}
      <HomeworkAssignmentDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => void reload()}
      />
    </div>
  );
}

export function HomeworkReviewPage() {
  const [tab, setTab] = useState<Tab>("submitted");
  const TABS: { id: Tab; label: string }[] = [
    { id: "submitted", label: "На перевірку" },
    { id: "reviewed", label: "Перевірені" },
    { id: "assignments", label: "Завдання учням" },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Домашні завдання</h1>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {tab === "assignments" ? <Assignments /> : <Submissions key={tab} tab={tab} />}
      </div>
    </Layout>
  );
}
