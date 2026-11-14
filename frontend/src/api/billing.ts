import { apiFetch } from "./client";
import type { BillingPeriod, CheckoutForm, Plan } from "./types";

export function getPlan(token: string): Promise<Plan> {
  return apiFetch<Plan>(token, "/api/billing");
}

export function startCheckout(token: string, period: BillingPeriod): Promise<CheckoutForm> {
  return apiFetch<CheckoutForm>(token, "/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}

export function cancelSubscription(token: string): Promise<Plan> {
  return apiFetch<Plan>(token, "/api/billing/cancel", { method: "POST" });
}

export function demoPay(token: string, orderId: string): Promise<Plan> {
  return apiFetch<Plan>(token, "/api/billing/demo/pay", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
}

/** LiqPay checkout is a plain form POST of `data` and `signature`. */
export function submitToLiqPay(form: CheckoutForm): void {
  const el = document.createElement("form");
  el.method = "POST";
  el.action = form.url;
  el.acceptCharset = "utf-8";
  for (const [name, value] of [
    ["data", form.data],
    ["signature", form.signature],
  ]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }
  document.body.appendChild(el);
  el.submit();
}

/** The JSON inside LiqPay's base64 `data` (UTF-8 safe). */
export function decodeCheckoutData(data: string): Record<string, string> {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>;
}
