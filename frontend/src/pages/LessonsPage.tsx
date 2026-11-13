import { useState, useEffect, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import { listLessons, deleteLesson } from "../api/lessons";
import { listStudents } from "../api/students";
import type { Lesson, Student, LessonStatus } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { LessonForm } from "../components/LessonForm";
import { LessonStatusForm } from "../components/LessonStatusForm";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatMoney } from "../lib/money";
import { formatDateTime, localInputToIso, todayKyiv, addDays } from "../lib/datetime";
import { useRouter } from "../lib/router";
import { Plus, Pencil, Trash2, RefreshCw, CalendarDays } from "lucide-react";

const STATUS_OPTIONS: { value: LessonStatus | "all"; label: string }[] = [
  { value: "all", label: "Всі статуси" },
  { value: "planned", label: "Заплановано" },
  { value: "done", label: "Проведено" },
  { value: "cancelled", label: "Скасовано" },
  { value: "missed", label: "Пропуск" },
];

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
      <div className="w-12 h-12 rounded-2xl bg-[#E8F1FF] flex items-center justify-center">
        <CalendarDays className="h-6 w-6 text-blue-600" />
      </div>
      <p className="text-sm">Занять не знайдено</p>
    </div>
  );
}

export function LessonsPage() {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";
  const { navigate } = useRouter();

  const today = todayKyiv();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [studentId, setStudentId] = useState("all");
  const [status, setStatus] = useState<LessonStatus | "all">("all");
  const [students, setStudents] = useState<Student[]>([]);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | undefined>();
  const [statusLesson, setStatusLesson] = useState<Lesson | undefined>();

  useEffect(() => {
    listStudents(token, false)
      .then(setStudents)
      .catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const filters: { from?: string; to?: string; student_id?: string; status?: LessonStatus } = {};
    if (from) filters.from = localInputToIso(`${from}T00:00`);
    if (to) filters.to = localInputToIso(`${addDays(to, 1)}T00:00`);
    if (studentId !== "all") filters.student_id = studentId;
    if (status !== "all") filters.status = status;
    listLessons(token, filters)
      .then(setLessons)
      .catch(() => setError("Не вдалося завантажити заняття"))
      .finally(() => setLoading(false));
  }, [token, from, to, studentId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (lesson: Lesson) => {
    if (!confirm("Видалити заняття?")) return;
    try {
      await deleteLesson(token, lesson.id);
      load();
    } catch {
      alert("Помилка видалення");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Заняття</h1>
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditLesson(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Нове заняття
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label
              htmlFor="lp-from"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              З дати
            </Label>
            <Input
              id="lp-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="lp-to"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              По дату
            </Label>
            <Input
              id="lp-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="lp-student"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Учень
            </Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger id="lp-student" className="w-48">
                <SelectValue placeholder="Всі учні" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі учні</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="lp-status"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Статус
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus | "all")}>
              <SelectTrigger id="lp-status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            Оновити
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : lessons.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
            <EmptyState />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата і час</TableHead>
                <TableHead>Учень</TableHead>
                <TableHead>Тривалість</TableHead>
                <TableHead className="text-right">Ціна</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Тема</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{formatDateTime(l.starts_at)}</TableCell>
                  <TableCell>
                    <button
                      className="font-semibold text-foreground hover:text-[#6D5DF6] transition-colors"
                      onClick={() => navigate(`/students/${l.student_id}`)}
                    >
                      {l.student_full_name}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.duration_minutes} хв
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(l.price)}</TableCell>
                  <TableCell>
                    <LessonStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.topic ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setStatusLesson(l)}
                        title="Змінити статус"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditLesson(l);
                          setFormOpen(true);
                        }}
                        title="Редагувати"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(l)}
                        title="Видалити"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {formOpen && (
        <LessonForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditLesson(undefined);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditLesson(undefined);
            load();
          }}
          initial={editLesson}
        />
      )}

      {statusLesson && (
        <LessonStatusForm
          open={!!statusLesson}
          onClose={() => setStatusLesson(undefined)}
          onSaved={() => {
            setStatusLesson(undefined);
            load();
          }}
          lesson={statusLesson}
        />
      )}
    </Layout>
  );
}
