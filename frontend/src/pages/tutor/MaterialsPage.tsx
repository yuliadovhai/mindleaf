import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../auth/session";
import {
  deleteMaterial,
  formatSize,
  generateQuiz,
  listGenerations,
  listMaterials,
  materialType,
  setShares,
  uploadMaterial,
} from "../../api/materials";
import { listStudents } from "../../api/students";
import type { Generation, Material, Student } from "../../api/types";
import { ApiError } from "../../api/client";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatDateTime } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { Download, FileUp, Share2, Sparkles, Trash2 } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "Фото",
  "image/png": "Фото",
  "text/plain": "Текст",
  "text/markdown": "Текст",
};

const GENERATION_LABEL = {
  pending: "Генерується… (до хвилини)",
  done: "Готово",
  failed: "Не вдалося",
} as const;

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const { token } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await uploadMaterial(token, file, title.trim(), description.trim() || null);
      setFile(null);
      setTitle("");
      setDescription("");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <FileUp className="h-5 w-5" />
        Завантажити матеріал
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="mt-file">Файл (PDF, JPEG, PNG, TXT, MD, до 10 МБ)</Label>
          <Input
            id="mt-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt,.md"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              setError("");
              if (picked && (!materialType(picked) || picked.size > 10 * 1024 * 1024)) {
                setError("Підтримуються PDF, JPEG, PNG, TXT і MD до 10 МБ");
                setFile(null);
                return;
              }
              setFile(picked);
              if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mt-title">Назва *</Label>
          <Input
            id="mt-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mt-desc">Опис</Label>
        <Textarea
          id="mt-desc"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !file || !title.trim()}>
        {busy ? "Завантажую…" : "Завантажити"}
      </Button>
    </form>
  );
}

function ShareDialog({
  material,
  onClose,
  onSaved,
}: {
  material: Material | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!material) return;
    setSelected(material.shared_with.map((s) => s.student_id));
    listStudents(token)
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [material, token]);

  return (
    <Dialog open={material !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Хто бачить «{material?.title}»</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Обрані учні та їхні батьки побачать матеріал у своєму кабінеті.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() =>
                  setSelected(
                    selected.includes(s.id)
                      ? selected.filter((x) => x !== s.id)
                      : [...selected, s.id]
                  )
                }
              />
              {s.full_name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            onClick={async () => {
              if (!material) return;
              await setShares(token, material.id, selected);
              onSaved();
              onClose();
            }}
          >
            Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog({
  material,
  onClose,
  onQueued,
}: {
  material: Material | null;
  onClose: () => void;
  onQueued: () => void;
}) {
  const { token } = useSession();
  const [count, setCount] = useState(8);
  const [written, setWritten] = useState(true);
  const [wishes, setWishes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!material) return;
    setBusy(true);
    setError("");
    try {
      await generateQuiz(token, material.id, {
        question_count: count,
        include_written: written,
        instructions: wishes.trim() || null,
      });
      onQueued();
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail === "too_many_generations"
          ? "Уже генерується 3 тести — зачекайте хвилину."
          : "Не вдалося запустити генерацію"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={material !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Тест з «{material?.title}»</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="gen-count">Кількість питань (1–20)</Label>
            <Input
              id="gen-count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={written} onChange={() => setWritten(!written)} />
            Додати питання з письмовою відповіддю
          </label>
          <div className="space-y-1">
            <Label htmlFor="gen-wishes">Побажання (необов'язково)</Label>
            <Textarea
              id="gen-wishes"
              rows={3}
              maxLength={1000}
              placeholder="Напр.: рівень 6 класу, більше задач на скорочення"
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ШІ (Claude Haiku) складе чернетку приблизно за хвилину. Ви її переглянете, виправите й
            опублікуєте — до того учні її не бачать.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button disabled={busy || count < 1 || count > 20} onClick={() => void submit()}>
            Згенерувати
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerationRow({ job }: { job: Generation }) {
  const { navigate } = useRouter();
  const variant =
    job.status === "done" ? "success" : job.status === "failed" ? "destructive" : "secondary";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
      <span>
        {job.material_title ?? "Видалений матеріал"} · {job.question_count} питань ·{" "}
        {formatDateTime(job.created_at)}
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={variant}>{GENERATION_LABEL[job.status]}</Badge>
        {job.quiz_id && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/quizzes/${job.quiz_id}/edit`)}
          >
            Відкрити чернетку
          </Button>
        )}
      </span>
    </div>
  );
}

export function MaterialsPage() {
  const { token } = useSession();
  const [sharing, setSharing] = useState<Material | null>(null);
  const [generating, setGenerating] = useState<Material | null>(null);

  const load = useCallback(async () => {
    const [materials, generations] = await Promise.all([
      listMaterials(token),
      listGenerations(token),
    ]);
    return { materials, generations };
  }, [token]);
  const { data, loading, error, reload } = useLoad(load);

  // While something is being generated, check again every 10 seconds.
  const pending = data?.generations.some((g) => g.status === "pending") ?? false;
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void reload(), 10_000);
    return () => window.clearInterval(timer);
  }, [pending, reload]);

  const remove = async (material: Material) => {
    if (!window.confirm(`Видалити «${material.title}»? Учні його більше не побачать.`)) return;
    await deleteMaterial(token, material.id);
    await reload();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Матеріали</h1>
        <UploadForm onUploaded={() => void reload()} />
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}

        {data && data.generations.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Тести з матеріалів
            </h2>
            {data.generations.slice(0, 5).map((job) => (
              <GenerationRow key={job.id} job={job} />
            ))}
          </section>
        )}

        {data && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Бібліотека</h2>
            {data.materials.length === 0 && (
              <p className="text-sm text-muted-foreground">Матеріалів ще немає.</p>
            )}
            {data.materials.map((m) => (
              <div key={m.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABEL[m.content_type] ?? m.content_type} · {formatSize(m.size_bytes)} ·{" "}
                      {m.original_name}
                    </p>
                    {m.description && <p className="text-sm mt-1">{m.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={m.download_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                        Відкрити
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setSharing(m)}
                    >
                      <Share2 className="h-4 w-4" />
                      Доступ
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setGenerating(m)}>
                      <Sparkles className="h-4 w-4" />
                      Згенерувати тест
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Видалити"
                      onClick={() => void remove(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {m.shared_with.length === 0 ? (
                    <span className="text-muted-foreground">Бачите лише ви</span>
                  ) : (
                    m.shared_with.map((s) => (
                      <Badge key={s.student_id} variant="outline">
                        {s.full_name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <ShareDialog
        material={sharing}
        onClose={() => setSharing(null)}
        onSaved={() => void reload()}
      />
      <GenerateDialog
        material={generating}
        onClose={() => setGenerating(null)}
        onQueued={() => void reload()}
      />
    </Layout>
  );
}
