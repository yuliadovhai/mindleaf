import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import {
  getMyHomeworkAssignment,
  submitAssignment,
  uploadAssignmentPhoto,
} from "../../api/homework";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { HomeworkAnswer } from "../../components/HomeworkAnswer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ArrowLeft, Paperclip } from "lucide-react";

/** Homework given on its own: description, deadline, attached materials. */
export function HomeworkAssignmentPage({ id }: { id: string }) {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();
  const load = useCallback(() => getMyHomeworkAssignment(token, id), [token, id]);
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

  const overdue = data.due_at && !data.submission && data.due_at < new Date().toISOString();

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/homework")}>
          <ArrowLeft className="h-4 w-4" />
          Усі ДЗ
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{data.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {data.student_full_name}
              {data.due_at && (
                <span className={overdue ? "text-destructive font-medium" : ""}>
                  {" "}
                  · здати до {formatDateTime(data.due_at)}
                </span>
              )}
            </p>
            {data.description && <p className="whitespace-pre-wrap">{data.description}</p>}
            {data.materials.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Матеріали</p>
                {data.materials.map((m) => (
                  <a
                    key={m.id}
                    href={m.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    {m.title}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <HomeworkAnswer
          answer={data.submission}
          canSubmit={me.role === "student"}
          upload={(file) => uploadAssignmentPhoto(token, id, file)}
          submit={(body) => submitAssignment(token, id, body)}
          onSaved={(saved) =>
            setData({ ...data, submission: saved, submission_status: saved.status })
          }
        />
      </div>
    </Layout>
  );
}
