import { apiFetch } from "./client";
import type { Payment, PaymentCreate, PaymentUpdate } from "./types";

export interface PaymentFilters {
  student_id?: string;
  from?: string;
  to?: string;
}

export function listPayments(token: string, filters: PaymentFilters = {}): Promise<Payment[]> {
  const params = new URLSearchParams();
  if (filters.student_id) params.set("student_id", filters.student_id);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return apiFetch<Payment[]>(token, `/api/payments${qs ? `?${qs}` : ""}`);
}

export function getPayment(token: string, id: string): Promise<Payment> {
  return apiFetch<Payment>(token, `/api/payments/${id}`);
}

export function createPayment(token: string, data: PaymentCreate): Promise<Payment> {
  return apiFetch<Payment>(token, "/api/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePayment(token: string, id: string, data: PaymentUpdate): Promise<Payment> {
  return apiFetch<Payment>(token, `/api/payments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePayment(token: string, id: string): Promise<void> {
  return apiFetch<void>(token, `/api/payments/${id}`, { method: "DELETE" });
}
