import { Component, useCallback, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useSession } from "./auth/session";
import { MeContext } from "./auth/me";
import { getMe } from "./api/me";
import { setSigninRedirect } from "./api/client";
import { useRouter } from "./lib/router";
import { useLoad } from "./lib/useLoad";
import { LoginPage } from "./pages/LoginPage";
import { RoleChoicePage } from "./pages/RoleChoicePage";
import { DashboardPage } from "./pages/DashboardPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentPage } from "./pages/StudentPage";
import { LessonsPage } from "./pages/LessonsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { HomeworkReviewPage } from "./pages/tutor/HomeworkReviewPage";
import { QuizzesPage } from "./pages/tutor/QuizzesPage";
import { QuizAssignmentPage } from "./pages/tutor/QuizAssignmentPage";
import { QuizEditPage } from "./pages/tutor/QuizEditPage";
import { MaterialsPage } from "./pages/tutor/MaterialsPage";
import { HomeworkAssignmentPage } from "./pages/portal/HomeworkAssignmentPage";
import { PortalMaterialsPage } from "./pages/portal/PortalMaterialsPage";
import { PortalHomePage } from "./pages/portal/PortalHomePage";
import { PortalSchedulePage } from "./pages/portal/PortalSchedulePage";
import { PortalHomeworkPage } from "./pages/portal/PortalHomeworkPage";
import { HomeworkLessonPage } from "./pages/portal/HomeworkLessonPage";
import { PortalQuizzesPage } from "./pages/portal/PortalQuizzesPage";
import { PortalQuizPage } from "./pages/portal/PortalQuizPage";
import { PortalPaymentsPage } from "./pages/portal/PortalPaymentsPage";
import { Button } from "./components/ui/button";
import type { Role } from "./api/types";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Щось пішло не так. Оновіть сторінку.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-2xl font-bold">404</p>
        <p className="text-muted-foreground">Сторінку не знайдено</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function TutorPages({ path }: { path: string }) {
  const student = path.match(/^\/students\/([^/]+)$/);
  const assignment = path.match(/^\/quiz-assignments\/([^/]+)$/);
  const quizEdit = path.match(/^\/quizzes\/([^/]+)\/edit$/);
  if (path === "/") return <DashboardPage />;
  if (path === "/students") return <StudentsPage />;
  if (student) return <StudentPage id={student[1]} />;
  if (path === "/lessons") return <LessonsPage />;
  if (path === "/payments") return <PaymentsPage />;
  if (path === "/homework") return <HomeworkReviewPage />;
  if (path === "/quizzes") return <QuizzesPage />;
  if (quizEdit) return <QuizEditPage id={quizEdit[1]} />;
  if (assignment) return <QuizAssignmentPage id={assignment[1]} />;
  if (path === "/materials") return <MaterialsPage />;
  return <NotFound />;
}

/** Students and parents share these pages; each shows what that role may see. */
function PortalPages({ path, role }: { path: string; role: Role }) {
  const homework = path.match(/^\/lessons\/([^/]+)\/homework$/);
  const quiz = path.match(/^\/quizzes\/([^/]+)$/);
  const homeworkAssignment = path.match(/^\/homework\/([^/]+)$/);
  if (path === "/") return <PortalHomePage />;
  if (path === "/schedule") return <PortalSchedulePage />;
  if (path === "/homework") return <PortalHomeworkPage />;
  if (homework) return <HomeworkLessonPage id={homework[1]} />;
  if (homeworkAssignment) return <HomeworkAssignmentPage id={homeworkAssignment[1]} />;
  if (path === "/materials") return <PortalMaterialsPage />;
  if (path === "/quizzes") return <PortalQuizzesPage />;
  if (quiz) return <PortalQuizPage id={quiz[1]} />;
  if (path === "/payments" && role === "parent") return <PortalPaymentsPage />;
  return <NotFound />;
}

/** Loads /api/me once and picks the cabinet by role. */
function Cabinet() {
  const { token, signOut } = useSession();
  const { path } = useRouter();
  const load = useCallback(() => getMe(token), [token]);
  const { data: me, loading, error, reload } = useLoad(load);

  if (loading && !me) return <Spinner />;
  if (error || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive">Не вдалося завантажити профіль. Чи запущено backend?</p>
          <Button variant="outline" onClick={signOut}>
            Вийти
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MeContext.Provider value={{ me, reload }}>
      {me.role === null ? (
        <RoleChoicePage />
      ) : (
        <ErrorBoundary key={path}>
          {me.role === "tutor" ? (
            <TutorPages path={path} />
          ) : (
            <PortalPages path={path} role={me.role} />
          )}
        </ErrorBoundary>
      )}
    </MeContext.Provider>
  );
}

export function App() {
  const session = useSession();
  const { signIn } = session;

  useEffect(() => {
    setSigninRedirect(async () => signIn());
  }, [signIn]);

  if (session.isLoading) return <Spinner />;
  if (!session.isAuthenticated) return <LoginPage />;
  return <Cabinet />;
}
