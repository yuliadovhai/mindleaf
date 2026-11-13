import { useCallback } from "react";
import { useSession } from "../../auth/session";
import { formatSize, listMyMaterials } from "../../api/materials";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Button } from "../../components/ui/button";
import { formatDate } from "../../lib/datetime";
import { useLoad } from "../../lib/useLoad";
import { Download, FileText } from "lucide-react";

export function PortalMaterialsPage() {
  const { token } = useSession();
  const load = useCallback(() => listMyMaterials(token), [token]);
  const { data, loading, error } = useLoad(load);

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Матеріали</h1>
        {error && <ErrorMessage message={error} />}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Репетитор ще нічого не відкрив.</p>
        )}
        {data?.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_4px_20px_rgba(109,93,246,0.06)]"
          >
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium">{m.title}</p>
                {m.description && <p className="text-sm">{m.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {m.original_name} · {formatSize(m.size_bytes)} · {formatDate(m.created_at)}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={m.download_url} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
                Відкрити
              </a>
            </Button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
