import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { formatSize, listMyMaterials } from "../../api/materials";
import { listMyHomeworkAssignments } from "../../api/homework";
import type { MemberMaterial } from "../../api/types";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SegmentedTabs } from "../../components/common/SegmentedTabs";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatWhenInline } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { BookOpen, Download, File, FileText, Image, Search, type LucideIcon } from "lucide-react";

const DAY = 24 * 3600 * 1000;

type Kind = "pdf" | "image" | "text" | "file";
type Filter = "all" | Kind;

function kindOf(m: MemberMaterial): Kind {
  const type = m.content_type.toLowerCase();
  const name = m.original_name.toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("text/") || /\.(md|txt)$/.test(name)) return "text";
  return "file";
}

const KIND: Record<Kind, { label: string; plural: string; icon: LucideIcon; tile: string }> = {
  pdf: {
    label: "PDF",
    plural: "PDF",
    icon: FileText,
    tile: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
  image: {
    label: "Фото",
    plural: "Фото",
    icon: Image,
    tile: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  },
  text: {
    label: "Конспект",
    plural: "Конспекти",
    icon: FileText,
    tile: "bg-accent text-primary",
  },
  file: {
    label: "Файл",
    plural: "Файли",
    icon: File,
    tile: "bg-muted text-muted-foreground",
  },
};

export function PortalMaterialsPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<{ material: MemberMaterial; text: string } | null>(null);

  const load = useCallback(async () => {
    const [materials, homework] = await Promise.all([
      listMyMaterials(token),
      listMyHomeworkAssignments(token),
    ]);
    // Which homework needs which material: shown on the card, so the student knows why it's there.
    const usedIn = new Map<string, { id: string; title: string }[]>();
    for (const h of homework) {
      for (const m of h.materials) {
        usedIn.set(m.id, [...(usedIn.get(m.id) ?? []), { id: h.id, title: h.title }]);
      }
    }
    return { materials, usedIn };
  }, [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  const materials = data?.materials ?? [];
  const kinds = (Object.keys(KIND) as Kind[]).filter((k) => materials.some((m) => kindOf(m) === k));
  const q = query.trim().toLowerCase();
  const shown = materials.filter(
    (m) =>
      (filter === "all" || kindOf(m) === filter) &&
      (!q || `${m.title} ${m.description ?? ""}`.toLowerCase().includes(q))
  );
  const fresh = new Date(Date.now() - 3 * DAY).toISOString();

  // Text notes open right here; PDF and photos open in the browser's own viewer.
  const view = async (m: MemberMaterial) => {
    if (kindOf(m) !== "text") {
      window.open(m.download_url, "_blank", "noopener");
      return;
    }
    try {
      const res = await fetch(m.download_url);
      if (!res.ok) throw new Error(String(res.status));
      setPreview({ material: m, text: await res.text() });
    } catch {
      window.open(m.download_url, "_blank", "noopener");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Матеріали</h1>
          <p className="text-sm text-muted-foreground">
            Конспекти, фото й файли, які відкрив вам репетитор.
          </p>
        </div>
        {error && <ErrorMessage message={error} />}

        {materials.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Репетитор ще нічого не відкрив — конспекти й файли з'являться тут.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {kinds.length > 1 ? (
                <SegmentedTabs
                  value={filter}
                  onChange={setFilter}
                  items={[
                    { value: "all" as Filter, label: "Усі", count: materials.length },
                    ...kinds.map((k) => ({
                      value: k as Filter,
                      label: KIND[k].plural,
                      count: materials.filter((m) => kindOf(m) === k).length,
                    })),
                  ]}
                />
              ) : (
                <span />
              )}
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Пошук за назвою"
                  className="pl-9"
                />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Нічого не знайшлося.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((m) => {
                  const kind = kindOf(m);
                  const { label, icon: Icon, tile } = KIND[kind];
                  const usedIn = data?.usedIn.get(m.id) ?? [];
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_20px_rgba(109,93,246,0.06)] transition-shadow hover:shadow-[0_8px_28px_rgba(109,93,246,0.14)]"
                    >
                      <button
                        onClick={() => void view(m)}
                        className="flex flex-1 flex-col text-left"
                        aria-label={`Відкрити «${m.title}»`}
                      >
                        {kind === "image" ? (
                          <img
                            src={m.download_url}
                            alt=""
                            className="h-24 w-full border-b sm:h-36 border-border object-cover"
                          />
                        ) : (
                          <div className={`flex h-24 items-center justify-center sm:h-36 ${tile}`}>
                            <Icon className="h-12 w-12 opacity-80" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col gap-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold leading-snug">{m.title}</p>
                            {m.created_at >= fresh && <Badge>Нове</Badge>}
                          </div>
                          {m.description && (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {m.description}
                            </p>
                          )}
                          <p className="mt-auto pt-2 text-xs text-muted-foreground">
                            {label} · {formatSize(m.size_bytes)} · {formatWhenInline(m.created_at)}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
                        {usedIn.length > 0 ? (
                          <button
                            onClick={() => navigate(`/homework/${usedIn[0].id}`)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-primary hover:underline"
                          >
                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              Для ДЗ «{usedIn[0].title}»
                              {usedIn.length > 1 ? ` і ще ${usedIn.length - 1}` : ""}
                            </span>
                          </button>
                        ) : (
                          <span className="flex-1" />
                        )}
                        <a
                          href={m.download_url}
                          download={m.original_name}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Завантажити
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {preview && (
        <Dialog open onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle className="pr-6">{preview.material.title}</DialogTitle>
              {preview.material.description && (
                <DialogDescription>{preview.material.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
              <NoteText text={preview.text} />
            </div>
            <a
              href={preview.material.download_url}
              download={preview.material.original_name}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Завантажити файл
            </a>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}

/** Just enough Markdown for a tutor's notes: headings, bullet lists and paragraphs. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          const size = heading[1].length === 1 ? "text-lg" : "text-base";
          return (
            <p key={i} className={`${size} pt-1 font-semibold`}>
              {heading[2]}
            </p>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet)
          return (
            <p key={i} className="-indent-3 pl-4">
              • {bullet[1]}
            </p>
          );
        if (!line.trim()) return null;
        return <p key={i}>{line}</p>;
      })}
    </>
  );
}
