import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { formatSize, listMaterials, setShares, uploadMaterial } from "../../api/materials";
import type { Material } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import { Button } from "../ui/button";
import { CARD } from "../../lib/labels";
import { useLoad } from "../../lib/useLoad";
import { Download, FileUp, Link2, X } from "lucide-react";

/** Which library materials this student (and their parents) can open. */
export function StudentMaterialsTab({ studentId }: { studentId: string }) {
  const { token } = useSession();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => listMaterials(token), [token]);
  const { data, loading, error: loadError, reload } = useLoad(load);

  const isShared = (m: Material) => m.shared_with.some((s) => s.student_id === studentId);
  const shared = data?.filter(isShared) ?? [];
  const others = data?.filter((m) => !isShared(m)) ?? [];

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося зберегти");
    } finally {
      setBusy(false);
    }
  };

  const share = (m: Material) =>
    setShares(token, m.id, [...m.shared_with.map((s) => s.student_id), studentId]);
  const unshare = (m: Material) =>
    setShares(
      token,
      m.id,
      m.shared_with.map((s) => s.student_id).filter((id) => id !== studentId)
    );

  if (loading) return <LoadingSpinner />;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Відкриті матеріали учень і батьки бачать у розділі «Матеріали» свого кабінету. Матеріали,
        прикріплені до ДЗ, видно з ДЗ і без цього.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {others.length > 0 && (
          <>
            <select
              aria-label="Матеріал з бібліотеки"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">Вибрати з бібліотеки…</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={busy || !pick}
              onClick={() => {
                const m = others.find((x) => x.id === pick);
                if (m) void run(() => share(m)).then(() => setPick(""));
              }}
            >
              <Link2 className="h-4 w-4" />
              Відкрити учню
            </Button>
          </>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
          <FileUp className="h-4 w-4" />
          {busy ? "Зачекайте…" : "Завантажити новий"}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void run(async () => {
                const m = await uploadMaterial(
                  token,
                  file,
                  file.name.replace(/\.[^.]+$/, ""),
                  null
                );
                await setShares(token, m.id, [studentId]);
              });
            }}
          />
        </label>
      </div>
      {(error || loadError) && <ErrorMessage message={error || loadError} />}

      <section className="space-y-2">
        <h3 className="font-semibold">Відкрито учню</h3>
        {shared.length === 0 && (
          <p className="text-sm text-muted-foreground">Поки нічого не відкрито.</p>
        )}
        {shared.map((m) => (
          <div
            key={m.id}
            className={`${CARD} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}
          >
            <span>
              <span className="block font-medium">{m.title}</span>
              <span className="block text-xs text-muted-foreground">
                {m.original_name} · {formatSize(m.size_bytes)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={m.download_url} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  Відкрити
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void run(() => unshare(m))}
              >
                <X className="h-4 w-4" />
                Прибрати доступ
              </Button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
