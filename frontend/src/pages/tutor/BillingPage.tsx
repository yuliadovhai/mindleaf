import { useCallback, useState } from "react";
import { useSession } from "../../auth/session";
import { cancelSubscription, getPlan, startCheckout, submitToLiqPay } from "../../api/billing";
import type { BillingPeriod } from "../../api/types";
import { ApiError } from "../../api/client";
import { Layout } from "../../components/Layout";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatDate } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { useRouter } from "../../lib/router";
import { Check, Crown, Lock } from "lucide-react";

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

export function BillingPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => getPlan(token), [token]);
  const { data: plan, setData, loading, error: loadError } = useLoad(load);
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
      setData(await cancelSubscription(token));
    } catch (e) {
      setError(ERRORS[e instanceof ApiError ? String(e.detail) : ""] ?? "Не вдалося скасувати");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  if (loadError || !plan)
    return (
      <Layout>
        <ErrorMessage message={loadError || "Не вдалося завантажити тариф"} />
      </Layout>
    );

  const isPro = plan.plan === "pro";
  const renewing = isPro && plan.subscription_status === "active" && !plan.cancel_pending;
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

        <Card>
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
                  {renewing ? "Наступне списання" : "Оплачено до"} {formatDate(plan.pro_until)}
                  {plan.period && ` · ${plan.period === "month" ? "щомісяця" : "щороку"}`}
                </p>
              )}
              {plan.cancel_pending && (
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
                  <p className="text-xs text-muted-foreground">
                    Оплата карткою через LiqPay. Списується автоматично щоперіоду; скасувати можна
                    будь-коли тут, оплачений час залишиться.
                    {plan.billing_mode === "demo" && " Зараз демо-режим: справжніх списань немає."}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        {error && <ErrorMessage message={error} />}
      </div>
    </Layout>
  );
}
