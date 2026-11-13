import { useAuth } from "react-oidc-context";
import { useRouter } from "../lib/router";
import { Button } from "./ui/button";
import { LayoutDashboard, Users, CalendarDays, CreditCard, LogOut } from "lucide-react";

const NAV = [
  { label: "Дашборд", path: "/", icon: LayoutDashboard },
  { label: "Учні", path: "/students", icon: Users },
  { label: "Заняття", path: "/lessons", icon: CalendarDays },
  { label: "Оплати", path: "/payments", icon: CreditCard },
] as const;

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const auth = useAuth();
  const { path, navigate } = useRouter();

  const handleLogout = () => {
    void auth.removeUser().then(() => {
      const domain = import.meta.env.VITE_COGNITO_DOMAIN;
      const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
      const logoutUri = encodeURIComponent(window.location.origin + "/");
      window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            {NAV.map(({ label, path: to, icon: Icon }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  path === to || (to !== "/" && path.startsWith(to))
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            Вийти
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
