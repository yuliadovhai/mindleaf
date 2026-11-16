import { useState } from "react";
import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { updateMe } from "../api/me";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

/**
 * First sign-in, before the role: the sign-up form asks only for an email, so the
 * cabinet would greet "?" without this. Shown once, until the account has a name.
 */
export function NamePage() {
  const { token, signOut } = useSession();
  const { me, reload } = useMe();
  const [name, setName] = useState(me.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await updateMe(token, { name: name.trim() });
      await reload();
    } catch {
      setError("Не вдалося зберегти. Спробуйте ще раз.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <form
        className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Як вас звати?</h1>
          <p className="text-sm text-muted-foreground">
            Це ім'я побачать ваш репетитор, учні чи батьки.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Ім'я та прізвище</Label>
          <Input
            id="full-name"
            autoFocus
            autoComplete="name"
            maxLength={200}
            placeholder="Наприклад, Олена Коваль"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {me.email && <p className="text-xs text-muted-foreground">Ви увійшли як {me.email}</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
          {busy ? "Зберігаю…" : "Далі"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
          Вийти
        </Button>
      </form>
    </div>
  );
}
