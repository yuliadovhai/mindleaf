import { DEV_LOGIN, devLogin, useSession } from "../auth/session";
import { Button } from "../components/ui/button";
import { GraduationCap, UserRound, Users } from "lucide-react";

/** Demo accounts created by `make seed`. */
const DEMO_ACCOUNTS = [
  {
    sub: "local-dev",
    title: "Репетитор",
    hint: "Учні, заняття, оплати, ДЗ і тести",
    icon: GraduationCap,
  },
  {
    sub: "local-dev-student",
    title: "Учень",
    hint: "Олена Коваль: розклад, ДЗ, тести",
    icon: UserRound,
  },
  {
    sub: "local-dev-parent",
    title: "Батьки",
    hint: "Ірина Коваль: розклад, оплати, скасування",
    icon: Users,
  },
] as const;

export function LoginPage() {
  const session = useSession();

  if (session.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-card rounded-2xl border border-border shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="relative h-14 w-14 rounded-2xl bg-[#6D5DF6] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9">
                <path
                  d="M12 20C12 20 4 14 4 8C4 5.8 5.8 4 8 4C9.6 4 11 5 12 6.4C13 5 14.4 4 16 4C18.2 4 20 5.8 20 8C20 14 12 20 12 20Z"
                  fill="white"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold">
            Кабінет{" "}
            <span className="bg-gradient-to-r from-[#6D5DF6] to-[#4F7BF7] bg-clip-text text-transparent">
              репетитора
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">Увійдіть, щоб продовжити</p>
        </div>

        {DEV_LOGIN && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Демо-вхід без реєстрації</p>
            {DEMO_ACCOUNTS.map(({ sub, title, hint, icon: Icon }) => (
              <button
                key={sub}
                onClick={() => devLogin(sub)}
                className="w-full flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:border-primary/40 hover:bg-accent/50 transition-all"
              >
                <Icon className="h-6 w-6 text-primary shrink-0" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground">
              Працює лише локально, з демо-даними з <code>make seed</code>.
            </p>
          </div>
        )}

        {session.error && (
          <p className="text-sm text-destructive text-center">
            Не вдалося увійти. Спробуйте ще раз.
          </p>
        )}
        <Button
          className="w-full"
          variant={DEV_LOGIN ? "outline" : "default"}
          onClick={session.signIn}
        >
          Увійти / Зареєструватися
        </Button>
      </div>
    </div>
  );
}
