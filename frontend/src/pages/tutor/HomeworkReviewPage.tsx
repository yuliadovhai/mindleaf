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
import { CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { LearningHeader } from "../../components/LearningHeader";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { EmptyState } from "../../components/common/EmptyState";

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
        <EmptyState
          icon={tab === "submitted" ? CheckCircle2 : ClipboardList}
          text={tab === "submitted" ? "Усе перевірено — нічого не чекає." : "Перевірених ще немає."}
        />
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

function Assignments({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { token } = useSession();
  const load = useCallback(() => listHomeworkAssignments(token), [token]);
  const { data, loading, error, reload } = useLoad(load);

  return (
    <div className="space-y-3">
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {data?.length === 0 && (
        <EmptyState icon={ClipboardList} text="Ви ще не задавали окремих ДЗ." />
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
  const [creating, setCreating] = useState(false);

  return (
    <Layout>
      <div className="space-y-5">
        <LearningHeader
          section="homework"
          actions={
            <Button
              className="gap-1.5"
              onClick={() => {
                setTab("assignments");
                setCreating(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Задати ДЗ
            </Button>
          }
        />
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "submitted", label: "На перевірку" },
            { value: "reviewed", label: "Перевірені" },
            { value: "assignments", label: "Задані" },
          ]}
        />
        {tab === "assignments" ? (
          <Assignments open={creating} setOpen={setCreating} />
        ) : (
          <Submissions key={tab} tab={tab} />
        )}
      </div>
    </Layout>
  );
}
