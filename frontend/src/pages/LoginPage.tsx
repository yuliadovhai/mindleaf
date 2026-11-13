import { useAuth } from "react-oidc-context";
import { Button } from "../components/ui/button";

function Logo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="56" height="56" rx="18" fill="#6D5DF6" />
        <path
          d="M28 10C22 10 15 15.5 13 21.5C11 27.5 14 34 19 37.5L28 43L37 37.5C42 34 45 27.5 43 21.5C41 15.5 34 10 28 10Z"
          fill="white"
          fillOpacity="0.95"
        />
        <line
          x1="28"
          y1="43"
          x2="28"
          y2="22"
          stroke="#6D5DF6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-2xl font-bold text-foreground tracking-tight">mindleaf</span>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#EEEBFF] border-t-[#6D5DF6]" />
      </div>
    );
  }

  if (auth.error) {
    console.error("Auth error:", auth.error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Не вдалося увійти. Спробуйте ще раз.</p>
          <Button onClick={() => void auth.signinRedirect()}>Спробувати знову</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <Logo />

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Кабінет{" "}
            <span className="bg-gradient-to-r from-[#6D5DF6] to-[#4F7BF7] bg-clip-text text-transparent">
              репетитора
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">Увійдіть, щоб продовжити</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 shadow-[0_4px_20px_rgba(109,93,246,0.08)]">
          <Button className="w-full h-11 text-base" onClick={() => void auth.signinRedirect()}>
            Увійти / Зареєструватися
          </Button>
        </div>
      </div>
    </div>
  );
}
