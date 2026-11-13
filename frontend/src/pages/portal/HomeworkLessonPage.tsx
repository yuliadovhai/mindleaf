import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { useMe } from "../../auth/me";
import { getMyLesson } from "../../api/portal";
import { getLessonHomework, submitHomework, uploadPhoto } from "../../api/homework";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { HomeworkAnswer } from "../../components/HomeworkAnswer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ArrowLeft } from "lucide-react";

/** Homework given in a lesson (the lesson's homework text). */
export function HomeworkLessonPage({ id }: { id: string }) {
  const { token } = useSession();
  const { me } = useMe();
  const { navigate } = useRouter();

  const load = useCallback(async () => {
    const [lesson, answer] = await Promise.all([
      getMyLesson(token, id),
      getLessonHomework(token, id),
    ]);
    return { lesson, answer };
  }, [token, id]);
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

  const { lesson, answer } = data;

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/homework")}>
          <ArrowLeft className="h-4 w-4" />
          Усі ДЗ
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Завдання з заняття</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {lesson.student_full_name} · {formatDateTime(lesson.starts_at)}
              {lesson.topic ? ` · ${lesson.topic}` : ""}
            </p>
            <p className="text-base">{lesson.homework ?? "Без домашнього завдання"}</p>
          </CardContent>
        </Card>
        <HomeworkAnswer
          answer={answer}
          canSubmit={me.role === "student" && Boolean(lesson.homework)}
          upload={(file) => uploadPhoto(token, id, file)}
          submit={(body) => submitHomework(token, id, body)}
          onSaved={(saved) => setData({ lesson, answer: saved })}
        />
      </div>
    </Layout>
  );
}
