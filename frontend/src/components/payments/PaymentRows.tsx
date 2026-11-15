import type { Lesson, Payment } from "../../api/types";
import { formatDate } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { CARD, METHOD_LABEL } from "../../lib/labels";
import { BookOpen, Pencil, Wallet } from "lucide-react";

export interface MoneyRow {
  key: string;
  at: string;
  /** Kopecks; positive = money in, negative = a charged lesson. */
  amount: number;
  title: string;
  payment?: Payment;
  lesson?: Lesson;
  /** Balance after this row (the student's ledger). */
  after?: number;
}

/** Payments and charged lessons as one list that reads the same on a phone. */
export function PaymentRows({
  rows,
  onPayment,
}: {
  rows: MoneyRow[];
  onPayment: (payment: Payment) => void;
}) {
  return (
    <ul className={`${CARD} divide-y divide-border/60 overflow-hidden`}>
      {rows.map((r) => {
        const detail = r.payment
          ? [METHOD_LABEL[r.payment.method], r.payment.comment].filter(Boolean).join(" · ")
          : (r.lesson?.topic ?? "Проведене заняття");
        const body = (
          <>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                r.payment
                  ? "bg-[#E6F8EF] text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {r.payment ? <Wallet className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.title}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {formatDate(r.at)} · {detail}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className={`block font-semibold ${r.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}
              >
                {r.amount > 0 ? "+" : "−"}
                {formatMoney(Math.abs(r.amount))}
              </span>
              {r.after !== undefined && (
                <span
                  className={`block text-xs ${r.after < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  баланс {formatMoney(r.after)}
                </span>
              )}
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.payment ? (
              <button
                onClick={() => onPayment(r.payment!)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                title="Змінити або видалити оплату"
              >
                {body}
                <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 pr-11">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
