import { useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { useMe } from "../auth/me";
import { linkTelegram, unlinkTelegram } from "../api/me";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { BellRing, CheckCircle2, Send } from "lucide-react";

/** What the bot sends, by role: shown before connecting and after. */
function whatYouGet(role: string | null): string[] {
  const lesson = "за годину до заняття — з посиланням, щоб одразу приєднатися";
  if (role === "tutor") return [lesson];
  return [lesson, "за добу до дедлайну домашнього завдання чи тесту, якщо його ще не здано"];
}

/** Connect or disconnect Telegram reminders for the signed-in account. */
export function TelegramDialog({ onClose }: { onClose: () => void }) {
  const { token } = useSession();
  const { me, reload } = useMe();
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Coming back from Telegram: check whether the bot already got "Start".
  useEffect(() => {
    if (!waiting) return;
    const check = () => void reload();
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 4000);
    return () => {
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, [waiting, reload]);

  useEffect(() => {
    if (me.telegram_connected) setWaiting(false);
  }, [me.telegram_connected]);

  const connect = async () => {
    setBusy(true);
    setError("");
    // Opened before the request so a phone browser doesn't block the pop-up.
    const tab = window.open("", "_blank");
    try {
      const { url } = await linkTelegram(token);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setWaiting(true);
    } catch {
      tab?.close();
      setError("Не вдалося відкрити бота. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await unlinkTelegram(token);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <BellRing className="h-5 w-5 text-primary" />
            Нагадування в Telegram
          </DialogTitle>
          <DialogDescription>
            {me.telegram_connected
              ? "Увімкнено. Бот MindLeaf пише вам:"
              : "Бот MindLeaf напише вам:"}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {whatYouGet(me.role).map((line) => (
            <li key={line} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>

        {me.telegram_connected ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Telegram підключено
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Вимкнути нагадування
            </Button>
          </div>
        ) : waiting ? (
          <div className="space-y-2 rounded-xl bg-accent/60 p-3 text-sm">
            <p className="font-medium">Майже готово</p>
            <p className="text-muted-foreground">
              У Telegram натисніть <b>Start</b> (або «Почати») і поверніться сюди — ми побачимо
              підключення самі.
            </p>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void connect()}>
              Відкрити бота ще раз
            </Button>
          </div>
        ) : (
          <Button className="w-full gap-2" disabled={busy} onClick={() => void connect()}>
            <Send className="h-4 w-4" />
            Підключити Telegram
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
