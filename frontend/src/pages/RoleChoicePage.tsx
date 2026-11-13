import { useState } from "react";
import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { becomeTutor, redeemInvite } from "../api/me";
import { ApiError } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { GraduationCap, KeyRound } from "lucide-react";

const REDEEM_ERRORS: Record<string, string> = {
  invite_not_found: "Код не знайдено, він уже використаний або прострочений.",
  role_conflict: "Цей код для іншої ролі, ніж у вашого акаунта.",
  already_linked: "Ви вже маєте доступ до цього учня.",
  student_already_linked: "До цього учня вже прив'язано акаунт учня.",
};

/** First sign-in: the account has no role yet. */
export function RoleChoicePage() {
  const { token, signOut } = useSession();
  const { reload } = useMe();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail) : "";
      setError(REDEEM_ERRORS[detail] ?? "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

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
          <h1 className="text-2xl font-bold">Хто ви?</h1>
          <p className="text-muted-foreground text-sm">Це обирається один раз.</p>
        </div>

        <form
          className="space-y-3 rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-accent/30 transition-all"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => redeemInvite(token, code));
          }}
        >
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-5 w-5 text-primary" />Я учень або батьки
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-code">Код від репетитора</Label>
            <Input
              id="invite-code"
              placeholder="XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || code.trim().length < 8}>
            Підтвердити код
          </Button>
        </form>

        <div className="space-y-3 rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-accent/30 transition-all">
          <div className="flex items-center gap-2 font-medium">
            <GraduationCap className="h-5 w-5 text-primary" />Я репетитор
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void run(() => becomeTutor(token))}
          >
            Створити кабінет репетитора
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" className="w-full" onClick={signOut}>
          Вийти
        </Button>
      </div>
    </div>
  );
}
