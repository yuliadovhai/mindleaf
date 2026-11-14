import { useState, useEffect, useCallback } from "react";
import { useSession } from "../auth/session";
import { getStudent, updateStudent } from "../api/students";
import { listLessons, deleteLesson } from "../api/lessons";
import type { Student, Lesson } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { StudentForm } from "../components/StudentForm";
import { LessonForm } from "../components/LessonForm";
import { LessonStatusForm } from "../components/LessonStatusForm";
import { StudentAccessPanel } from "../components/StudentAccessPanel";
import { StudentHomeworkTab } from "../components/student/StudentHomeworkTab";
import { StudentQuizzesTab } from "../components/student/StudentQuizzesTab";
import { StudentMaterialsTab } from "../components/student/StudentMaterialsTab";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
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
import { formatDateTime } from "../lib/datetime";
import { useRouter } from "../lib/router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Phone,
  MessageSquare,
  User,
  CalendarDays,
} from "lucide-react";
import type React from "react";

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

interface StudentPageProps {
  id: string;
}

type Tab = "lessons" | "homework" | "quizzes" | "materials" | "access";

const TABS: { id: Tab; label: string }[] = [
  { id: "lessons", label: "Заняття" },
  { id: "homework", label: "ДЗ" },
  { id: "quizzes", label: "Тести" },
  { id: "materials", label: "Матеріали" },
  { id: "access", label: "Доступ учня й батьків" },
];

export function StudentPage({ id }: StudentPageProps) {
  const { token } = useSession();
  const { navigate } = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tab, setTab] = useState<Tab>("lessons");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | undefined>();
  const [statusLesson, setStatusLesson] = useState<Lesson | undefined>();

  const loadStudent = useCallback(() => {
    return getStudent(token, id).then(setStudent);
  }, [token, id]);

  const loadLessons = useCallback(() => {
    return listLessons(token, { student_id: id }).then(setLessons);
  }, [token, id]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([loadStudent(), loadLessons()])
      .catch(() => setError("Не вдалося завантажити дані учня"))
      .finally(() => setLoading(false));
  }, [loadStudent, loadLessons]);

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm("Видалити заняття?")) return;
    try {
      await deleteLesson(token, lesson.id);
      await loadLessons();
      await loadStudent();
    } catch {
      alert("Помилка видалення");
    }
  };

  const handleUnarchive = async () => {
    if (!student) return;
    await updateStudent(token, student.id, { archived: false });
    await loadStudent();
  };

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <ErrorMessage message={error} />
      </Layout>
    );
  if (!student) return null;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{student.full_name}</h1>
                {student.archived && <Badge variant="muted">архів</Badge>}
              </div>
              {student.subject && (
                <p className="text-muted-foreground text-sm">{student.subject}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {student.archived && (
              <Button variant="outline" size="sm" onClick={() => void handleUnarchive()}>
                Розархівувати
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditStudentOpen(true)}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Редагувати
            </Button>
          </div>
        </div>

        {/* Info + Balance */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-4 space-y-2 text-sm shadow-[0_4px_20px_rgba(109,93,246,0.06)]">
            {student.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{student.phone}</span>
              </div>
            )}
            {student.telegram && (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>{student.telegram}</span>
              </div>
            )}
            {student.parent_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {student.parent_name}
                  {student.parent_phone && ` · ${student.parent_phone}`}
                </span>
              </div>
            )}
            {student.notes && (
              <p className="text-muted-foreground whitespace-pre-line">{student.notes}</p>
            )}
          </div>

          <div
            className={`rounded-2xl border p-4 flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(109,93,246,0.06)] ${
              student.balance < 0
                ? "bg-destructive/5 border-destructive/30"
                : student.balance > 0
                  ? "bg-green-50 border-green-200"
                  : "bg-card"
            }`}
          >
            <p className="text-sm text-muted-foreground mb-1">Баланс</p>
            <p
              className={`text-3xl font-bold ${
                student.balance < 0
                  ? "text-destructive"
                  : student.balance > 0
                    ? "text-green-600"
                    : ""
              }`}
            >
              {formatMoney(student.balance)}
            </p>
            {student.balance < 0 && (
              <p className="text-xs text-destructive mt-1">борг {formatMoney(-student.balance)}</p>
            )}
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0"
              onClick={() => navigate(`/payments/students/${student.id}`)}
            >
              Оплати й історія →
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`px-4 py-1.5 text-sm transition-colors rounded-full ${
                tab === t.id
                  ? "bg-white shadow-sm text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "lessons" ? ` (${lessons.length})` : ""}
            </button>
          ))}
        </div>

        {tab === "access" && <StudentAccessPanel studentId={id} />}
        {tab === "homework" && <StudentHomeworkTab studentId={id} archived={student.archived} />}
        {tab === "quizzes" && <StudentQuizzesTab studentId={id} archived={student.archived} />}
        {tab === "materials" && <StudentMaterialsTab studentId={id} />}

        {/* Lessons tab */}
        {tab === "lessons" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditLesson(undefined);
                  setLessonFormOpen(true);
                }}
                disabled={student.archived}
              >
                <Plus className="h-4 w-4" />
                Додати заняття
              </Button>
            </div>
            {lessons.length === 0 ? (
              <EmptyState icon={CalendarDays} text="Занять поки немає" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата і час</TableHead>
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
                      <TableCell className="text-sm">{l.duration_minutes} хв</TableCell>
                      <TableCell className="text-right text-sm">{formatMoney(l.price)}</TableCell>
                      <TableCell>
                        <LessonStatusBadge status={l.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.topic ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setStatusLesson(l);
                            }}
                            title="Змінити статус"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditLesson(l);
                              setLessonFormOpen(true);
                            }}
                            title="Редагувати"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDeleteLesson(l)}
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
        )}
      </div>

      {editStudentOpen && (
        <StudentForm
          open={editStudentOpen}
          onClose={() => setEditStudentOpen(false)}
          onSaved={() => {
            setEditStudentOpen(false);
            void loadStudent();
          }}
          initial={student}
        />
      )}

      {lessonFormOpen && (
        <LessonForm
          open={lessonFormOpen}
          onClose={() => {
            setLessonFormOpen(false);
            setEditLesson(undefined);
          }}
          onSaved={() => {
            setLessonFormOpen(false);
            setEditLesson(undefined);
            void loadLessons();
            void loadStudent();
          }}
          initial={editLesson}
          defaultStudentId={id}
        />
      )}

      {statusLesson && (
        <LessonStatusForm
          open={!!statusLesson}
          onClose={() => setStatusLesson(undefined)}
          onSaved={() => {
            setStatusLesson(undefined);
            void loadLessons();
            void loadStudent();
          }}
          lesson={statusLesson}
        />
      )}
    </Layout>
  );
}
