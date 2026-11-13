import { useCallback, useState } from "react";
import { useSession } from "../auth/session";
import { createInvite, listInvites, listLinks, removeLink, revokeInvite } from "../api/access";
import type { InviteCreated, Relation } from "../api/types";
import { ApiError } from "../api/client";
import { formatDateTime } from "../lib/datetime";
import { useLoad } from "../lib/useLoad";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import { Copy, KeyRound, Trash2 } from "lucide-react";

const RELATION_LABEL: Record<Relation, string> = { student: "Учень", parent: "Батьки" };

/** Invite codes and the accounts that can see this student's card. */
export function StudentAccessPanel({ studentId }: { studentId: string }) {
  const { token } = useSession();
  const [fresh, setFresh] = useState<InviteCreated | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [invites, links] = await Promise.all([
      listInvites(token, studentId),
      listLinks(token, studentId),
    ]);
    return { invites, links };
  }, [token, studentId]);
  const { data, loading, error: loadError, reload } = useLoad(load);

  const issue = async (relation: Relation) => {
    setError("");
    try {
      setFresh(await createInvite(token, studentId, relation));
      await reload();
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail === "student_already_linked"
          ? "У цього учня вже є акаунт учня. Код можна видати лише батькам."
          : "Не вдалося створити код"
      );
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Дайте учневі чи батькам код. Вони входять на сайт, вводять його й бачать розклад, ДЗ і тести
        цього учня; батьки — ще й оплати. Код одноразовий і діє 7 днів.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="gap-1.5" onClick={() => void issue("student")}>
          <KeyRound className="h-4 w-4" />
          Код для учня
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => void issue("parent")}>
          <KeyRound className="h-4 w-4" />
          Код для батьків
        </Button>
      </div>
      {error && <ErrorMessage message={error} />}
      {loadError && <ErrorMessage message={loadError} />}

      {fresh && (
        <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
          <p className="text-sm">
            Код для {fresh.relation === "student" ? "учня" : "батьків"} — покажіть його зараз, потім
            його вже не побачити:
          </p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl tracking-widest">{fresh.code}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Скопіювати"
              onClick={() => void navigator.clipboard?.writeText(fresh.code)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Діє до {formatDateTime(fresh.expires_at)}</p>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Мають доступ</h3>
        {data?.links.length === 0 && <p className="text-sm text-muted-foreground">Поки нікого.</p>}
        {data?.links.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between rounded-lg border px-4 py-2"
          >
            <span className="flex items-center gap-2">
              <Badge variant="outline">{RELATION_LABEL[link.relation]}</Badge>
              {link.user_name ?? link.user_email ?? "Без імені"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={async () => {
                if (!window.confirm("Забрати доступ до картки?")) return;
                await removeLink(token, studentId, link.id);
                await reload();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Забрати доступ
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Невикористані коди</h3>
        {data?.invites.length === 0 && <p className="text-sm text-muted-foreground">Немає.</p>}
        {data?.invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm"
          >
            <span>
              {RELATION_LABEL[invite.relation]} · діє до {formatDateTime(invite.expires_at)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await revokeInvite(token, studentId, invite.id);
                await reload();
              }}
            >
              Відкликати
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
