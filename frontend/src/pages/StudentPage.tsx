import { useState, useEffect, useCallback } from "react";
import { useSession } from "../auth/session";
import { getStudent, updateStudent } from "../api/students";
import { listLessons, deleteLesson } from "../api/lessons";
import { listPayments, deletePayment } from "../api/payments";
import type { Student, Lesson, Payment } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { StudentForm } from "../components/StudentForm";
import { LessonForm } from "../components/LessonForm";
import { LessonStatusForm } from "../components/LessonStatusForm";
import { PaymentForm } from "../components/PaymentForm";
import { StudentAccessPanel } from "../components/StudentAccessPanel";
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
} from "lucide-react";

const METHOD_LABEL = { cash: "Готівка", card: "Картка", transfer: "Переказ" } as const;

interface StudentPageProps {
  id: string;
}

type Tab = "lessons" | "payments" | "access";

export function StudentPage({ id }: StudentPageProps) {
  const { token } = useSession();
  const { navigate } = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<Tab>("lessons");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | undefined>();
  const [statusLesson, setStatusLesson] = useState<Lesson | undefined>();
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | undefined>();

  const loadStudent = useCallback(() => {
    return getStudent(token, id).then(setStudent);
  }, [token, id]);

  const loadLessons = useCallback(() => {
    return listLessons(token, { student_id: id }).then(setLessons);
  }, [token, id]);

  const loadPayments = useCallback(() => {
    return listPayments(token, { student_id: id }).then(setPayments);
  }, [token, id]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([loadStudent(), loadLessons(), loadPayments()])
      .catch(() => setError("Не вдалося завантажити дані учня"))
      .finally(() => setLoading(false));
  }, [loadStudent, loadLessons, loadPayments]);

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

  const handleDeletePayment = async (payment: Payment) => {
    if (!confirm("Видалити оплату?")) return;
    try {
      await deletePayment(token, payment.id);
      await loadPayments();
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
          <div className="sm:col-span-2 rounded-lg border bg-card p-4 space-y-2 text-sm">
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
            className={`rounded-lg border p-4 flex flex-col items-center justify-center ${
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
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === "lessons"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("lessons")}
          >
            Заняття ({lessons.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === "payments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("payments")}
          >
            Оплати ({payments.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === "access"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("access")}
          >
            Доступ учня й батьків
          </button>
        </div>

        {tab === "access" && <StudentAccessPanel studentId={id} />}

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
              <p className="text-muted-foreground text-sm">Занять поки немає</p>
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

        {/* Payments tab */}
        {tab === "payments" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditPayment(undefined);
                  setPaymentFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Додати оплату
              </Button>
            </div>
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Оплат поки немає</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Сума</TableHead>
                    <TableHead>Спосіб</TableHead>
                    <TableHead>Коментар</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDateTime(p.paid_at)}</TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        {formatMoney(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm">{METHOD_LABEL[p.method]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.comment ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditPayment(p);
                              setPaymentFormOpen(true);
                            }}
                            title="Редагувати"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDeletePayment(p)}
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

      {paymentFormOpen && (
        <PaymentForm
          open={paymentFormOpen}
          onClose={() => {
            setPaymentFormOpen(false);
            setEditPayment(undefined);
          }}
          onSaved={() => {
            setPaymentFormOpen(false);
            setEditPayment(undefined);
            void loadPayments();
            void loadStudent();
          }}
          initial={editPayment}
          defaultStudentId={id}
        />
      )}
    </Layout>
  );
}
