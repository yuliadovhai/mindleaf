import { DEV_LOGIN, GOOGLE_LOGIN, devLogin, useSession } from "../auth/session";
import { Button } from "../components/ui/button";
import { Logo } from "../components/Logo";
import { useTheme } from "../lib/theme";
import { GraduationCap, Moon, Sun, UserRound, Users } from "lucide-react";

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
  const { theme, toggle } = useTheme();

  if (session.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <button
        onClick={toggle}
        aria-label={theme === "dark" ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="w-full max-w-md space-y-6 p-8 bg-card rounded-2xl border border-border shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
        <div className="text-center space-y-3">
          <h1 className="flex justify-center">
            <Logo size="lg" tagline />
          </h1>
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
        {GOOGLE_LOGIN && (
          <button
            onClick={session.signInWithGoogle}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-card text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <GoogleMark />
            Увійти через Google
          </button>
        )}
        <Button
          className="w-full"
          variant={DEV_LOGIN || GOOGLE_LOGIN ? "outline" : "default"}
          onClick={session.signIn}
        >
          {GOOGLE_LOGIN ? "Увійти через email" : "Увійти / Зареєструватися"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <a href="/privacy" className="hover:text-foreground hover:underline">
            Політика конфіденційності
          </a>
        </p>
      </div>
    </div>
  );
}

/** The four-colour Google "G" (brand guidelines ask for it as is). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
