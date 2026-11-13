export interface Tutor {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
}

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
}
