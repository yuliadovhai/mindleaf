import { useAuth } from "react-oidc-context";
import { useRouter } from "./lib/router";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentPage } from "./pages/StudentPage";
import { LessonsPage } from "./pages/LessonsPage";
import { PaymentsPage } from "./pages/PaymentsPage";

export function App() {
  const auth = useAuth();
  const { path } = useRouter();

  if (auth.isLoading || (!auth.isAuthenticated && !auth.error)) {
    if (!auth.isLoading) {
      return <LoginPage />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage />;
  }

  if (path === "/") return <DashboardPage />;
  if (path === "/students") return <StudentsPage />;

  const studentMatch = path.match(/^\/students\/([^/]+)$/);
  if (studentMatch) return <StudentPage id={studentMatch[1]} />;

  if (path === "/lessons") return <LessonsPage />;
  if (path === "/payments") return <PaymentsPage />;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-2xl font-bold">404</p>
        <p className="text-muted-foreground">Сторінку не знайдено</p>
      </div>
    </div>
  );
}
