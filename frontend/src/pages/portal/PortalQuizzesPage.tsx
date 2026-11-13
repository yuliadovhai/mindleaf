import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { listMyAssignments } from "../../api/quizzes";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { AssignmentStatusBadge } from "../../components/AssignmentStatusBadge";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";

export function PortalQuizzesPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const load = useCallback(() => listMyAssignments(token), [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  const many = new Set((data ?? []).map((a) => a.student_id)).size > 1;

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Тести</h1>
        {error && <ErrorMessage message={error} />}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">Тестів поки немає.</p>}
        {data?.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/quizzes/${a.id}`)}
            className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50"
          >
            <span>
              <span className="block font-medium">{a.quiz_title}</span>
              <span className="block text-xs text-muted-foreground">
                {many ? `${a.student_full_name} · ` : ""}
                {a.due_at ? `Здати до ${formatDateTime(a.due_at)}` : "Без строку"}
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
      </div>
    </Layout>
  );
}
