import { useState } from "react";
import { useSession } from "../../auth/session";
import { cancelSubscription, redeemPromo, startCheckout, submitToLiqPay } from "../../api/billing";
import type { BillingPeriod } from "../../api/types";
import { ApiError } from "../../api/client";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { formatDate } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { usePlanContext } from "../../lib/planContext";
import { useRouter } from "../../lib/router";
import { Check, Crown, Lock, Ticket } from "lucide-react";

const FREE_FEATURES = [
  "До 3 активних учнів",
  "Заняття, оплати, борги, дашборд",
  "Кабінет учня й батьків, ДЗ, матеріали",
  "Тести з автоперевіркою варіантів",
];

const PRO_FEATURES = [
  "Без обмеження кількості учнів",
  "Усе з безкоштовного тарифу",
  "ШІ перевіряє письмові відповіді в тестах",
  "ШІ генерує тести з ваших матеріалів",
];

const ERRORS: Record<string, string> = {
  already_subscribed: "Підписка Pro вже активна.",
  billing_disabled: "Оплата тимчасово недоступна.",
  no_active_subscription: "Активної підписки немає.",
};

const PROMO_ERRORS: Record<string, string> = {
  promo_not_found: "Промокод не знайдено.",
  promo_used_up: "Цей промокод вже вичерпано.",
  promo_already_used: "Ви вже активували цей промокод.",
};

export function BillingPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState("");
  const { plan, planLoading, setPlan } = usePlanContext();
  const justPaid = new URLSearchParams(window.location.search).get("checkout") === "done";

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const form = await startCheckout(token, period);
      if (form.mode === "demo") {
        navigate(
          `/billing/demo-checkout?order=${form.order_id}&data=${encodeURIComponent(form.data)}`
        );
      } else {
        submitToLiqPay(form);
      }
    } catch (e) {
      setError(ERRORS[e instanceof ApiError ? String(e.detail) : ""] ?? "Не вдалося почати оплату");
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm("Скасувати автоматичне продовження Pro? Оплачений час залишиться.")) return;
    setBusy(true);
    setError("");
    try {
      setPlan(await cancelSubscription(token));
    } catch (e) {
      setError(ERRORS[e instanceof ApiError ? String(e.detail) : ""] ?? "Не вдалося скасувати");
    } finally {
      setBusy(false);
    }
  };

  const applyPromo = async () => {
    setPromoBusy(true);
    setPromoError("");
    try {
      const updated = await redeemPromo(token, promoCode);
      setPlan(updated);
      setPromoOpen(false);
      setPromoCode("");
    } catch (e) {
      setPromoError(
        PROMO_ERRORS[e instanceof ApiError ? String(e.detail) : ""] ??
          "Не вдалося активувати промокод"
      );
    } finally {
      setPromoBusy(false);
    }
  };

  if (planLoading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (!plan)
    return (
      <Layout>
        <ErrorMessage message="Не вдалося завантажити тариф" />
      </Layout>
    );

  const isPro = plan.plan === "pro";
  const fromPromo = plan.pro_source === "promo";
  const renewing =
    isPro && !fromPromo && plan.subscription_status === "active" && !plan.cancel_pending;
  const price = plan.prices[period];
  const monthlyEquivalent = Math.round(plan.prices.year / 12);

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold">Тариф</h1>

        {justPaid && !isPro && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            Дякуємо! Чекаємо підтвердження від LiqPay — зазвичай це кілька секунд. Оновіть сторінку.
          </p>
        )}
        {plan.read_only && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Зараз кабінет лише для перегляду: активних учнів {plan.active_students}, а
              безкоштовний тариф дозволяє {plan.free_student_limit}. Оформіть Pro або заархівуйте
              зайвих учнів (архівація доступна завжди).
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <Card className="sm:flex-1">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ваш тариф</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {isPro ? (
                    <>
                      <Crown className="h-6 w-6 text-amber-500" /> Pro
                    </>
                  ) : (
                    "Безкоштовний"
                  )}
                </p>
                {isPro && plan.pro_until && (
                  <p className="text-sm">
                    {fromPromo ? (
                      <>Pro до {formatDate(plan.pro_until)} (промокод)</>
                    ) : (
                      <>
                        {renewing ? "Наступне списання" : "Оплачено до"}{" "}
                        {formatDate(plan.pro_until)}
                        {plan.period && ` · ${plan.period === "month" ? "щомісяця" : "щороку"}`}
                      </>
                    )}
                  </p>
                )}
                {plan.cancel_pending && !fromPromo && (
                  <p className="text-sm text-muted-foreground">Скасування надіслано в LiqPay…</p>
                )}
                {!isPro && (
                  <p className="text-sm text-muted-foreground">
                    Активних учнів: {plan.active_students} з {plan.free_student_limit}
                  </p>
                )}
              </div>
              {renewing && (
                <Button variant="outline" disabled={busy} onClick={() => void cancel()}>
                  Скасувати автопродовження
                </Button>
              )}
            </CardContent>
          </Card>

          <button
            type="button"
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center transition-colors hover:border-primary/70 hover:bg-primary/10 sm:w-1/3 dark:bg-primary/10 dark:hover:bg-primary/15"
            onClick={() => {
              setPromoCode("");
              setPromoError("");
              setPromoOpen(true);
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary group-hover:bg-primary/25 dark:bg-primary/20 dark:group-hover:bg-primary/30">
              <Ticket className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {fromPromo ? "Додати ще промокод" : "Маю промокод"}
              </p>
              <p className="text-sm text-muted-foreground">Активуйте Pro за промокодом</p>
            </div>
          </button>
        </div>

        {!renewing && (
          <>
            <div className="inline-flex rounded-lg border p-1">
              {(["month", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    period === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {p === "month" ? "Щомісяця" : "Щороку"}
                  {p === "year" && (
                    <Badge variant="success" className="ml-2">
                      −2 місяці
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Безкоштовний</CardTitle>
                  <p className="text-3xl font-bold">0 грн</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {FREE_FEATURES.map((f) => (
                    <p key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      {f}
                    </p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-primary border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Pro
                  </CardTitle>
                  <p className="text-3xl font-bold">
                    {formatMoney(price)}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {period === "month" ? "місяць" : "рік"}
                    </span>
                  </p>
                  {period === "year" && (
                    <p className="text-sm text-muted-foreground">
                      ≈ {formatMoney(monthlyEquivalent)} на місяць
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {PRO_FEATURES.map((f) => (
                      <p key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        {f}
                      </p>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={busy || plan.billing_mode === "disabled"}
                    onClick={() => void pay()}
                  >
                    {isPro ? "Продовжити Pro" : "Оформити Pro"}
                  </Button>
                  {plan.billing_mode === "disabled" ? (
                    <p className="text-xs text-muted-foreground">Онлайн-оплата скоро з'явиться.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Оплата карткою через LiqPay. Списується автоматично щоперіоду; скасувати можна
                      будь-коли тут, оплачений час залишиться.
                      {plan.billing_mode === "demo" &&
                        " Зараз демо-режим: справжніх списань немає."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
        {error && <ErrorMessage message={error} />}
      </div>

      <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Промокод</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Введіть промокод"
              disabled={promoBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && promoCode.trim()) void applyPromo();
              }}
            />
            {promoError && <p className="text-sm text-destructive">{promoError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={promoBusy}>
                Скасувати
              </Button>
            </DialogClose>
            <Button onClick={() => void applyPromo()} disabled={promoBusy || !promoCode.trim()}>
              Застосувати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
