import { useState, useEffect, useCallback } from "react";
import { useSession } from "../auth/session";
import { getStudent, updateStudent } from "../api/students";
import { listLessons } from "../api/lessons";
import type { Student, Lesson } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { StudentForm } from "../components/StudentForm";
import { LessonForm } from "../components/LessonForm";
import { StudentAccessPanel } from "../components/StudentAccessPanel";
import { StudentHomeworkTab } from "../components/student/StudentHomeworkTab";
import { StudentQuizzesTab } from "../components/student/StudentQuizzesTab";
import { StudentMaterialsTab } from "../components/student/StudentMaterialsTab";
import { LessonList } from "../components/lessons/LessonList";
import { LessonDialog } from "../components/lessons/LessonDialog";
import { EmptyState } from "../components/common/EmptyState";
import { SegmentedTabs } from "../components/common/SegmentedTabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { formatMoney } from "../lib/money";
import { CARD } from "../lib/labels";
import { useRouter } from "../lib/router";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  KeyRound,
  ListChecks,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  User,
} from "lucide-react";

type Tab = "lessons" | "homework" | "quizzes" | "materials" | "access";

export function StudentPage({ id }: { id: string }) {
  const { token } = useSession();
  const { navigate } = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tab, setTab] = useState<Tab>("lessons");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState<{ initial?: Lesson } | null>(null);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);

  const loadStudent = useCallback(() => getStudent(token, id).then(setStudent), [token, id]);
  // Newest first: the tutor looks at what happened last and what comes next.
  const loadLessons = useCallback(
    () => listLessons(token, { student_id: id }).then((list) => setLessons([...list].reverse())),
    [token, id]
  );
  const reloadAll = useCallback(() => {
    void loadLessons();
    void loadStudent();
  }, [loadLessons, loadStudent]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([loadStudent(), loadLessons()])
      .catch(() => setError("Не вдалося завантажити дані учня"))
      .finally(() => setLoading(false));
  }, [loadStudent, loadLessons]);

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
  if (error || !student)
    return (
      <Layout>
        <ErrorMessage message={error || "Учня не знайдено"} />
      </Layout>
    );

  const contacts = [
    student.phone && { icon: Phone, text: student.phone },
    student.telegram && { icon: MessageSquare, text: student.telegram },
    student.parent_name && {
      icon: User,
      text: `${student.parent_name}${student.parent_phone ? ` · ${student.parent_phone}` : ""}`,
    },
  ].filter(Boolean) as { icon: typeof Phone; text: string }[];

  const balanceTone =
    student.balance < 0
      ? "text-destructive"
      : student.balance > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";

  return (
    <Layout>
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 gap-1.5"
          onClick={() => navigate("/students")}
        >
          <ArrowLeft className="h-4 w-4" />
          Учні
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{student.full_name}</h1>
              {student.archived && <Badge variant="muted">в архіві</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[student.subject, `${formatMoney(student.default_price)} за заняття`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {student.archived && (
              <Button variant="outline" onClick={() => void handleUnarchive()}>
                Повернути з архіву
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditStudentOpen(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Редагувати
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
          <div className={`${CARD} space-y-2 p-4 text-sm`}>
            {contacts.length === 0 && !student.notes && (
              <p className="text-muted-foreground">Контактів ще немає.</p>
            )}
            {contacts.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{text}</span>
              </div>
            ))}
            {student.notes && (
              <p className="whitespace-pre-line text-muted-foreground">{student.notes}</p>
            )}
          </div>

          <button
            onClick={() => navigate(`/payments/students/${student.id}`)}
            className={`${CARD} flex items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/30`}
          >
            <span>
              <span className="block text-sm text-muted-foreground">
                {student.balance < 0 ? "Борг" : "Баланс"}
              </span>
              <span className={`block text-2xl font-bold ${balanceTone}`}>
                {formatMoney(Math.abs(student.balance))}
              </span>
              <span className="block text-xs text-primary">Оплати й історія</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "lessons", label: "Заняття", icon: CalendarDays },
            { value: "homework", label: "ДЗ", icon: ClipboardCheck },
            { value: "quizzes", label: "Тести", icon: ListChecks },
            { value: "materials", label: "Матеріали", icon: FolderOpen },
            { value: "access", label: "Доступ", icon: KeyRound },
          ]}
        />

        {tab === "access" && <StudentAccessPanel studentId={id} />}
        {tab === "homework" && <StudentHomeworkTab studentId={id} archived={student.archived} />}
        {tab === "quizzes" && <StudentQuizzesTab studentId={id} archived={student.archived} />}
        {tab === "materials" && <StudentMaterialsTab studentId={id} />}

        {tab === "lessons" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Натисніть на заняття, щоб відмітити чи змінити його.
              </p>
              <Button
                className="shrink-0 gap-1.5"
                onClick={() => setLessonForm({})}
                disabled={student.archived}
              >
                <Plus className="h-4 w-4" />
                Заняття
              </Button>
            </div>
            {lessons.length === 0 ? (
              <EmptyState icon={CalendarDays} text="Занять поки немає" />
            ) : (
              <LessonList
                lessons={lessons}
                hideStudent
                onOpen={setOpenLesson}
                onChanged={reloadAll}
              />
            )}
          </div>
        )}
      </div>

      {editStudentOpen && (
        <StudentForm
          open
          onClose={() => setEditStudentOpen(false)}
          onSaved={() => {
            setEditStudentOpen(false);
            void loadStudent();
          }}
          initial={student}
        />
      )}

      {lessonForm && (
        <LessonForm
          open
          onClose={() => setLessonForm(null)}
          onSaved={() => {
            setLessonForm(null);
            reloadAll();
          }}
          initial={lessonForm.initial}
          defaultStudentId={id}
        />
      )}

      {openLesson && (
        <LessonDialog
          lesson={openLesson}
          onClose={() => setOpenLesson(null)}
          onChanged={reloadAll}
          onEdit={(lesson) => {
            setOpenLesson(null);
            setLessonForm({ initial: lesson });
          }}
        />
      )}
    </Layout>
  );
}
