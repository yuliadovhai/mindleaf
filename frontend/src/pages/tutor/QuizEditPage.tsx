import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { getQuiz, publishQuiz, replaceQuiz } from "../../api/quizzes";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { QuizEditor } from "../../components/QuizEditor";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

/** Review and edit a quiz that nobody has been assigned yet (e.g. an AI draft). */
export function QuizEditPage({ id }: { id: string }) {
  const { token } = useSession();
  const { navigate } = useRouter();
  const load = useCallback(() => getQuiz(token, id), [token, id]);
  const { data: quiz, setData, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error || !quiz)
    return (
      <Layout>
        <ErrorMessage message={error || "Не знайдено"} />
      </Layout>
    );

  const isDraft = quiz.status === "draft";

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/quizzes")}>
          <ArrowLeft className="h-4 w-4" />
          Усі тести
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {isDraft ? "Чернетка тесту" : "Редагування тесту"}
            {isDraft && (
              <Badge variant="warning" className="gap-1">
                <Sparkles className="h-3 w-3" />
                згенеровано ШІ
              </Badge>
            )}
          </h1>
          {isDraft && (
            <Button
              className="gap-1.5"
              onClick={async () => {
                setData(await publishQuiz(token, id));
                navigate("/quizzes");
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Опублікувати
            </Button>
          )}
        </div>
        {isDraft && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            ШІ склав цей тест за вашим матеріалом. Перевірте питання й правильні відповіді, виправте
            або видаліть зайве, збережіть зміни й опублікуйте — лише тоді тест можна призначити.
          </p>
        )}
        <QuizEditor
          key={quiz.updated_at}
          initial={quiz}
          submitLabel="Зберегти зміни"
          onSubmit={async (data) => setData(await replaceQuiz(token, id, data))}
        />
      </div>
    </Layout>
  );
}
