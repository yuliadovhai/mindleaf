import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { listHomework, listHomeworkAssignments } from "../../api/homework";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { HomeworkAssignmentDialog } from "../../components/HomeworkAssignmentDialog";
import { HomeworkAssignmentRow } from "../../components/HomeworkAssignmentRow";
import { SubmissionCard } from "../../components/SubmissionCard";
import { Button } from "../../components/ui/button";
import { useLoad } from "../../lib/useLoad";
import { Plus } from "lucide-react";

type Tab = "submitted" | "reviewed" | "assignments";

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
        <SubmissionCard
          key={item.id}
          item={item}
          onReviewed={(saved) => setData((data ?? []).filter((h) => h.id !== saved.id))}
        />
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
        <HomeworkAssignmentRow key={a.id} assignment={a} onDeleted={() => void reload()} />
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
