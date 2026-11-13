import { useAuth } from "react-oidc-context";
import { Button } from "../components/ui/button";

export function LoginPage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Помилка автентифікації: {auth.error.message}</p>
          <Button onClick={() => void auth.signinRedirect()}>Спробувати знову</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 p-8 bg-background rounded-xl border shadow-sm">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Кабінет репетитора</h1>
          <p className="text-muted-foreground text-sm">Увійдіть, щоб продовжити</p>
        </div>
        <Button className="w-full" onClick={() => void auth.signinRedirect()}>
          Увійти через Cognito
        </Button>
      </div>
    </div>
  );
}
