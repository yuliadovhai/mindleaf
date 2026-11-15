import { useState, useEffect, useCallback } from "react";
import { useSession } from "../auth/session";
import { listStudents, archiveStudent } from "../api/students";
import type { Student } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { StudentForm } from "../components/StudentForm";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { SegmentedTabs } from "../components/common/SegmentedTabs";
import { CARD } from "../lib/labels";
import { useRouter } from "../lib/router";
import { Plus, Archive, ChevronRight, Pencil, Users as UsersIcon } from "lucide-react";

export function StudentsPage() {
  const { token } = useSession();
  const { navigate } = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | undefined>();

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listStudents(token, showArchived)
      .then(setStudents)
      .catch(() => setError("Не вдалося завантажити список учнів"))
      .finally(() => setLoading(false));
  }, [token, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const handleArchive = async (student: Student) => {
    if (!confirm(`Перенести ${student.full_name} в архів? Історія збережеться.`)) return;
    try {
      await archiveStudent(token, student.id);
      load();
    } catch {
      alert("Помилка архівації");
    }
  };

  const openEdit = (student: Student) => {
    setEditTarget(student);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditTarget(undefined);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditTarget(undefined);
    load();
  };

  return (
    <Layout>
      <div className="space-y-4">
        <PageHeader
          title="Учні"
          subtitle="Відкрийте учня, щоб задати ДЗ, призначити тест чи поділитися матеріалом."
          actions={
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Додати учня
            </Button>
          }
        />

        <SegmentedTabs
          value={showArchived ? "archived" : "active"}
          onChange={(v) => setShowArchived(v === "archived")}
          items={[
            { value: "active", label: "Активні" },
            { value: "archived", label: "Архів" },
          ]}
        />

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : students.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            text={showArchived ? "В архіві нікого немає" : "Учнів поки немає"}
            action={
              !showArchived && (
                <Button onClick={openCreate} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Додати першого учня
                </Button>
              )
            }
          />
        ) : (
          <ul className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
            {students.map((s) => (
              <li
                key={s.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                onClick={() => navigate(`/students/${s.id}`)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                  {s.full_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{s.full_name}</span>
                    {s.archived && <Badge variant="muted">архів</Badge>}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[s.subject, s.phone ?? s.telegram, s.parent_name && `батьки: ${s.parent_name}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </span>
                <span
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => openEdit(s)}
                    aria-label="Редагувати"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="hidden lg:inline">Редагувати</span>
                  </Button>
                  {!s.archived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden gap-1.5 text-muted-foreground sm:inline-flex"
                      onClick={() => void handleArchive(s)}
                      aria-label="В архів"
                    >
                      <Archive className="h-4 w-4" />
                      <span className="hidden lg:inline">В архів</span>
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {formOpen && (
        <StudentForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(undefined);
          }}
          onSaved={handleSaved}
          initial={editTarget}
        />
      )}
    </Layout>
  );
}
