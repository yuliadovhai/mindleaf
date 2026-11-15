import { useCallback, useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { getPlan } from "../api/billing";
import { useRouter } from "../lib/router";
import { useLoad } from "../lib/useLoad";
import { useTheme } from "../lib/theme";
import { ROLE_LABEL } from "../lib/labels";
import { Logo } from "./Logo";
import { PlanBanner } from "./PlanBanner";
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  Crown,
  FolderOpen,
  GraduationCap,
  Home,
  ListChecks,
  LogOut,
  Moon,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Plan, Role } from "../api/types";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Other paths that belong to this section (sub-pages, tabs). */
  also?: RegExp;
}

/** Five sections; the tariff lives in the profile corner, not in the work menu. */
const TUTOR_NAV: NavItem[] = [
  { label: "Сьогодні", path: "/", icon: Sun },
  { label: "Розклад", path: "/lessons", icon: CalendarDays },
  { label: "Учні", path: "/students", icon: Users },
  { label: "Оплати", path: "/payments", icon: CreditCard },
  {
    label: "Навчання",
    path: "/homework",
    icon: GraduationCap,
    also: /^\/(quizzes|quiz-assignments|materials)(\/|$)/,
  },
];

const STUDENT_NAV: NavItem[] = [
  { label: "Головна", path: "/", icon: Home },
  { label: "Розклад", path: "/schedule", icon: CalendarDays },
  { label: "ДЗ", path: "/homework", icon: BookOpen, also: /^\/lessons\/[^/]+\/homework$/ },
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

function isActive(current: string, item: NavItem): boolean {
  if (item.also?.test(current)) return true;
  if (item.path === "/") return current === "/";
  return current === item.path || current.startsWith(`${item.path}/`);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function usePlan(enabled: boolean): Plan | null {
  const { token } = useSession();
  const load = useCallback(
    () => (enabled ? getPlan(token) : Promise.resolve(null)),
    [enabled, token]
  );
  return useLoad(load).data ?? null;
}

function PlanChip({ plan }: { plan: Plan | null }) {
  if (!plan) return null;
  return plan.plan === "pro" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6D5DF6] to-[#4F7BF7] px-2 py-0.5 text-[11px] font-semibold text-white">
      <Crown className="h-3 w-3" />
      Pro
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Безкоштовний
    </span>
  );
}

/** Name, role, plan and the account actions (Тариф, Вийти). */
function ProfilePanel({ plan, onNavigate }: { plan: Plan | null; onNavigate?: () => void }) {
  const { navigate, path } = useRouter();
  const session = useSession();
  const { me } = useMe();
  const { theme, toggle } = useTheme();
  const name = me.name ?? me.email ?? "";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
          {initials(name) || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {me.role && ROLE_LABEL[me.role]}
            {session.isDev && (
              <span className="rounded-full bg-[#FFF1E6] px-1.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                демо
              </span>
            )}
          </div>
        </div>
      </div>
      {me.role === "tutor" && (
        <button
          onClick={() => {
            navigate("/billing");
            onNavigate?.();
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            path.startsWith("/billing")
              ? "bg-accent font-semibold text-primary"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          <Crown className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Тариф</span>
          <PlanChip plan={plan} />
        </button>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={session.signOut}
          className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Вийти
        </button>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({ items, plan }: { items: NavItem[]; plan: Plan | null }) {
  const { navigate, path } = useRouter();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto px-3" aria-label="Розділи">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(path, item);
            return (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-accent font-semibold text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-3 py-3">
        <ProfilePanel plan={plan} />
      </div>
    </aside>
  );
}

/** Phone: a slim top bar with the profile button, and the sections at the bottom. */
function MobileChrome({ items, plan }: { items: NavItem[]; plan: Plan | null }) {
  const { navigate, path } = useRouter();
  const { me } = useMe();
  const [profileOpen, setProfileOpen] = useState(false);
  const name = me.name ?? me.email ?? "";

  useEffect(() => setProfileOpen(false), [path]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
        <Logo />
        <button
          onClick={() => setProfileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary"
          aria-label="Профіль, тариф і вихід"
        >
          {initials(name) || "?"}
        </button>
      </header>

      {profileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-4 pb-8 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <ProfilePanel plan={plan} onNavigate={() => setProfileOpen(false)} />
          </div>
        </div>
      )}

      <nav
        aria-label="Розділи"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex">
          {items.map((item) => {
            const active = isActive(path, item);
            return (
              <li key={item.path} className="flex-1">
                <button
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] ${
                    active ? "font-semibold text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-accent" : ""
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  /** Narrow pages (forms, a single quiz) read better at a smaller width. */
  width?: "wide" | "narrow";
}

export function Layout({ children, width = "wide" }: LayoutProps) {
  const { me } = useMe();
  const items = navFor(me.role);
  const plan = usePlan(me.role === "tutor");

  return (
    <div className="min-h-screen">
      <DesktopSidebar items={items} plan={plan} />
      <MobileChrome items={items} plan={plan} />
      <main className="pb-24 md:pb-0 md:pl-60">
        <div
          className={`mx-auto px-4 py-5 md:px-8 md:py-8 ${
            width === "narrow" ? "max-w-3xl" : "max-w-6xl"
          }`}
        >
          {me.role === "tutor" && <PlanBanner plan={plan} />}
          {children}
        </div>
      </main>
    </div>
  );
}
