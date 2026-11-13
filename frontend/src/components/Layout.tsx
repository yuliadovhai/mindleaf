import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "../lib/router";
import { LayoutDashboard, Users, CalendarDays, CreditCard, LogOut, Menu, X } from "lucide-react";

const NAV = [
  { label: "Дашборд", path: "/", icon: LayoutDashboard },
  { label: "Учні", path: "/students", icon: Users },
  { label: "Заняття", path: "/lessons", icon: CalendarDays },
  { label: "Оплати", path: "/payments", icon: CreditCard },
] as const;

function MindleafLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="10" fill="#6D5DF6" />
        <path
          d="M16 6C12 6 8 9.5 7 13.5C6 17.5 8 22 12 24.5L16 27L20 24.5C24 22 26 17.5 25 13.5C24 9.5 20 6 16 6Z"
          fill="white"
          fillOpacity="0.95"
        />
        <line
          x1="16"
          y1="27"
          x2="16"
          y2="14"
          stroke="#6D5DF6"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold text-foreground tracking-tight">mindleaf</span>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const auth = useAuth();
  const { path, navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userEmail = auth.user?.profile.email ?? "";
  const userName = (auth.user?.profile.name as string | undefined) ?? "";
  const displayName = userName || userEmail || "Репетитор";

  const handleLogout = () => {
    void auth.removeUser().then(() => {
      const domain = import.meta.env.VITE_COGNITO_DOMAIN;
      const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
      const logoutUri = encodeURIComponent(window.location.origin + "/");
      window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
    });
  };

  const isActive = (to: string) =>
    to === "/" ? path === "/" : path === to || path.startsWith(to + "/");

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <MindleafLogo />
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.map(({ label, path: to, icon: Icon }) => (
          <button
            key={to}
            onClick={() => {
              navigate(to);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive(to)
                ? "bg-[#EEEBFF] text-[#6D5DF6]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon
              className={`h-4.5 w-4.5 flex-shrink-0 ${isActive(to) ? "text-[#6D5DF6]" : ""}`}
              style={{ width: "18px", height: "18px" }}
            />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4 space-y-1">
        <div className="px-3 py-1">
          <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
          {userName && userEmail && (
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut style={{ width: "18px", height: "18px" }} className="flex-shrink-0" />
          Вийти
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col flex-shrink-0 bg-white border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-border transform transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
            aria-label="Закрити меню"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-border px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
            aria-label="Відкрити меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <MindleafLogo />
          <div className="w-9" />
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
