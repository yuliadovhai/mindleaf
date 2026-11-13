export type Role = "tutor" | "student" | "parent";
export type Relation = "student" | "parent";

export interface Me {
  id: string;
  role: Role | null;
  email: string | null;
  name: string | null;
  cancel_notice_hours: number;
  created_at: string;
}

/** @deprecated kept for older imports; the profile is `Me` now. */
export type Tutor = Me;

export interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  telegram: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  subject: string | null;
  default_price: number;
  notes: string | null;
  archived: boolean;
  created_at: string;
  balance: number;
}

export interface StudentCreate {
  full_name: string;
  default_price: number;
  phone?: string | null;
  telegram?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  subject?: string | null;
  notes?: string | null;
}

export interface StudentUpdate {
  full_name?: string;
  default_price?: number;
  phone?: string | null;
  telegram?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  subject?: string | null;
  notes?: string | null;
  archived?: boolean;
}

export type LessonStatus = "planned" | "done" | "cancelled" | "missed";
export type PaymentMethod = "cash" | "card" | "transfer";

export interface Lesson {
  id: string;
  student_id: string;
  student_full_name: string;
  starts_at: string;
  duration_minutes: number;
  price: number;
  status: LessonStatus;
  topic: string | null;
  homework: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by_role: Role | null;
  created_at: string;
}

export interface LessonCreate {
  student_id: string;
  starts_at: string;
  duration_minutes?: number;
  price?: number;
  status?: LessonStatus;
  topic?: string | null;
  homework?: string | null;
  notes?: string | null;
}

export interface LessonUpdate {
  starts_at?: string;
  duration_minutes?: number;
  price?: number;
  topic?: string | null;
  homework?: string | null;
  notes?: string | null;
}

export interface LessonStatusUpdate {
  status: LessonStatus;
}

export interface Payment {
  id: string;
  student_id: string;
  student_full_name: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  comment: string | null;
  created_at: string;
}

export interface PaymentCreate {
  student_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at?: string;
  comment?: string | null;
}

export interface PaymentUpdate {
  amount?: number;
  paid_at?: string;
  method?: PaymentMethod;
  comment?: string | null;
}

export interface Debtor {
  student_id: string;
  full_name: string;
  balance: number;
  archived: boolean;
}

export interface Dashboard {
  date: string;
  today: Lesson[];
  upcoming: Lesson[];
  income_month: number;
  debt_total: number;
  debtors: Debtor[];
  homework_to_review: number;
  quizzes_to_review: number;
}

// ---------- access: invite codes and links ----------

export interface Invite {
  id: string;
  relation: Relation;
  expires_at: string;
  created_at: string;
}

export interface InviteCreated extends Invite {
  code: string;
}

export interface StudentLink {
  id: string;
  relation: Relation;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

export interface Redeemed {
  student_id: string;
  student_full_name: string;
  relation: Relation;
}

// ---------- portal (student and parent) ----------

export interface PortalStudent {
  id: string;
  full_name: string;
  subject: string | null;
  tutor_name: string | null;
  relation: Relation;
  archived: boolean;
  balance: number | null;
}

export interface PortalLesson {
  id: string;
  student_id: string;
  student_full_name: string;
  tutor_name: string | null;
  starts_at: string;
  duration_minutes: number;
  status: LessonStatus;
  topic: string | null;
  homework: string | null;
  price: number | null;
  cancelled_at: string | null;
  cancelled_by_role: Role | null;
  can_cancel: boolean;
  cancel_deadline: string;
}

export interface PortalPayment {
  id: string;
  student_id: string;
  student_full_name: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
}

// ---------- homework ----------

export type SubmissionStatus = "submitted" | "reviewed";

export interface HomeworkPhoto {
  key: string;
  url: string;
}

/** A submission: exactly one of lesson_id / homework_id is set. */
export interface Homework {
  id: string;
  lesson_id: string | null;
  lesson_starts_at: string | null;
  homework_id: string | null;
  title: string | null;
  due_at: string | null;
  task: string | null;
  student_id: string;
  student_full_name: string;
  text: string | null;
  photos: HomeworkPhoto[];
  status: SubmissionStatus;
  feedback: string | null;
  grade: number | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface UploadTarget {
  url: string;
  fields: Record<string, string>;
  key: string;
  expires_at: number;
}

// ---------- quizzes ----------

export type QuestionKind = "single" | "multiple" | "text";
export type AssignmentStatus = "assigned" | "submitted" | "needs_review" | "graded";
export type GradedBy = "auto" | "ai" | "tutor";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  options: QuizOption[] | null;
  correct_options: string[] | null;
  reference_answer: string | null;
}

export type QuizStatus = "draft" | "ready";

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  source_material_id: string | null;
  questions: QuizQuestion[];
  max_score: number;
  assignment_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  status: QuizStatus;
  question_count: number;
  max_score: number;
  assignment_count: number;
  updated_at: string;
}

export interface QuestionIn {
  kind: QuestionKind;
  prompt: string;
  points: number;
  options?: { text: string; correct: boolean }[] | null;
  reference_answer?: string | null;
}

export interface QuizIn {
  title: string;
  description?: string | null;
  questions: QuestionIn[];
}

export interface QuizAnswer {
  selected_options: string[] | null;
  text_answer: string | null;
  points: number | null;
  feedback: string | null;
  graded_by: GradedBy | null;
}

export interface Assignment {
  id: string;
  quiz_id: string;
  quiz_title: string;
  student_id: string;
  student_full_name: string;
  status: AssignmentStatus;
  due_at: string | null;
  score: number | null;
  max_score: number;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
}

export interface AssignmentQuestion extends QuizQuestion {
  answer: QuizAnswer | null;
}

export interface AssignmentDetail extends Assignment {
  questions: AssignmentQuestion[];
}

export interface AnswerIn {
  question_id: string;
  selected_options?: string[];
  text_answer?: string | null;
}

// ---------- materials ----------

export type MaterialType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "text/plain"
  | "text/markdown";

export interface Material {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  size_bytes: number;
  original_name: string;
  download_url: string;
  shared_with: { student_id: string; full_name: string }[];
  created_at: string;
}

export interface MemberMaterial {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  size_bytes: number;
  original_name: string;
  download_url: string;
  student_ids: string[];
  created_at: string;
}

export type GenerationStatus = "pending" | "done" | "failed";

export interface Generation {
  id: string;
  material_id: string | null;
  material_title: string | null;
  status: GenerationStatus;
  question_count: number;
  include_written: boolean;
  instructions: string | null;
  quiz_id: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

// ---------- homework assignments ----------

export interface AttachedMaterial {
  id: string;
  title: string;
  content_type: string;
  original_name: string;
  download_url: string;
}

export interface HomeworkAssignment {
  id: string;
  student_id: string;
  student_full_name: string;
  title: string;
  description: string | null;
  due_at: string | null;
  materials: AttachedMaterial[];
  submission_status: SubmissionStatus | null;
  grade: number | null;
  created_at: string;
}

export interface HomeworkAssignmentDetail extends HomeworkAssignment {
  submission: Homework | null;
}

export interface HomeworkAssignmentIn {
  student_id: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  material_ids: string[];
}
