import { useState, useEffect, useCallback } from "react";
import type React from "react";
import { useSession } from "../auth/session";
import { listStudents, archiveStudent } from "../api/students";
import type { Student } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { StudentForm } from "../components/StudentForm";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatMoney } from "../lib/money";
import { useRouter } from "../lib/router";
import { Plus, Archive, Pencil, Eye, Users as UsersIcon } from "lucide-react";

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
        <Icon className="h-6 w-6 text-primary/60" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

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
    if (!confirm(`Архівувати учня ${student.full_name}?`)) return;
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Учні</h1>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Додати учня
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(false)}
          >
            Активні
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
          >
            Архівовані
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : students.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            text={showArchived ? "Архівованих учнів немає" : "Учнів поки немає"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ім'я</TableHead>
                <TableHead>Предмет</TableHead>
                <TableHead className="text-right">Ціна</TableHead>
                <TableHead className="text-right">Баланс</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.full_name}
                    {s.archived && (
                      <Badge variant="muted" className="ml-2 text-xs">
                        архів
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.subject ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(s.default_price)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        s.balance < 0
                          ? "text-destructive font-medium"
                          : s.balance > 0
                            ? "text-green-600 font-medium"
                            : "text-muted-foreground"
                      }
                    >
                      {formatMoney(s.balance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/students/${s.id}`)}
                        title="Переглянути"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        title="Редагувати"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!s.archived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleArchive(s)}
                          title="Архівувати"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
