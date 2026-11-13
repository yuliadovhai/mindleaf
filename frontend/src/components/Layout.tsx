import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { useRouter } from "../lib/router";
import { ROLE_LABEL } from "../lib/labels";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../api/types";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const TUTOR_NAV: NavItem[] = [
  { label: "Дашборд", path: "/", icon: LayoutDashboard },
  { label: "Учні", path: "/students", icon: Users },
  { label: "Заняття", path: "/lessons", icon: CalendarDays },
  { label: "Оплати", path: "/payments", icon: CreditCard },
  { label: "ДЗ", path: "/homework", icon: ClipboardCheck },
  { label: "Тести", path: "/quizzes", icon: ListChecks },
];

const STUDENT_NAV: NavItem[] = [
  { label: "Головна", path: "/", icon: Home },
  { label: "Розклад", path: "/schedule", icon: CalendarDays },
  { label: "ДЗ", path: "/homework", icon: BookOpen },
  { label: "Тести", path: "/quizzes", icon: ListChecks },
];

const PARENT_NAV: NavItem[] = [
  ...STUDENT_NAV,
  { label: "Оплати", path: "/payments", icon: CreditCard },
];

function navFor(role: Role | null): NavItem[] {
  if (role === "tutor") return TUTOR_NAV;
  if (role === "student") return STUDENT_NAV;
  if (role === "parent") return PARENT_NAV;
  return [];
}

function isActive(current: string, to: string): boolean {
  if (to === "/") return current === "/";
  // /quiz-assignments/... belongs to "Тести", /lessons/<id>/homework to "ДЗ".
  if (to === "/quizzes" && current.startsWith("/quiz-assignments")) return true;
  if (to === "/homework" && /^\/lessons\/[^/]+\/homework$/.test(current)) return true;
  if (to === "/lessons" && /^\/lessons\/[^/]+\/homework$/.test(current)) return false;
  return current.startsWith(to);
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const session = useSession();
  const { me } = useMe();
  const { path, navigate } = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navFor(me.role).map(({ label, path: to, icon: Icon }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive(path, to)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {me.role && (
              <span className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                {me.name ?? me.email}
                <Badge variant="outline">{ROLE_LABEL[me.role]}</Badge>
                {session.isDev && <Badge variant="warning">демо</Badge>}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={session.signOut} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              Вийти
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
