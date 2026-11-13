import { useState } from "react";
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
  FolderOpen,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Users,
  X,
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
  { label: "Матеріали", path: "/materials", icon: FolderOpen },
];

const STUDENT_NAV: NavItem[] = [
  { label: "Головна", path: "/", icon: Home },
  { label: "Розклад", path: "/schedule", icon: CalendarDays },
  { label: "ДЗ", path: "/homework", icon: BookOpen },
  { label: "Тести", path: "/quizzes", icon: ListChecks },
  { label: "Матеріали", path: "/materials", icon: FolderOpen },
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
  if (to === "/quizzes" && current.startsWith("/quiz-assignments")) return true;
  if (to === "/homework" && /^\/lessons\/[^/]+\/homework$/.test(current)) return true;
  if (to === "/lessons" && /^\/lessons\/[^/]+\/homework$/.test(current)) return false;
  return current.startsWith(to);
}

function MindleafLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-8 w-8 rounded-xl bg-[#6D5DF6] flex items-center justify-center shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M12 20C12 20 4 14 4 8C4 5.8 5.8 4 8 4C9.6 4 11 5 12 6.4C13 5 14.4 4 16 4C18.2 4 20 5.8 20 8C20 14 12 20 12 20Z"
            fill="white"
          />
        </svg>
      </div>
      <span className="text-base font-bold tracking-tight text-foreground">mindleaf</span>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { navigate, path } = useRouter();
  const session = useSession();
  const { me } = useMe();

  const handleNav = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <MindleafLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5">
          {navFor(me.role).map(({ label, path: to, icon: Icon }) => (
            <li key={to}>
              <button
                onClick={() => handleNav(to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive(path, to)
                    ? "bg-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border px-3 py-4 space-y-3">
        {me.role && (
          <div className="px-2 space-y-1">
            <p className="text-sm font-medium truncate">{me.name ?? me.email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {ROLE_LABEL[me.role]}
              </Badge>
              {session.isDev && (
                <Badge variant="warning" className="text-xs">
                  демо
                </Badge>
              )}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={session.signOut}
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Вийти
        </Button>
      </div>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-60 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden ${
          mobileOpen ? "flex translate-x-0" : "flex -translate-x-full"
        }`}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm md:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Меню"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <main className="md:pl-60">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
