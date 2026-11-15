import { useState } from "react";
import { useSession } from "../../auth/session";
import { decodeCheckoutData, demoPay } from "../../api/billing";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useRouter } from "../../lib/router";
import { CreditCard } from "lucide-react";

/** Local demo only: stands in for LiqPay's checkout page. */
export function DemoCheckoutPage() {
  const { token } = useSession();
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = new URLSearchParams(window.location.search);
  const orderId = query.get("order") ?? "";
  let params: Record<string, string> = {};
  try {
    params = decodeCheckoutData(query.get("data") ?? "");
  } catch {
    params = {};
  }

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      await demoPay(token, orderId);
      navigate("/billing?checkout=done");
    } catch {
      setError("Демо-оплата не вдалася");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Демо-оплата
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Тут була б сторінка LiqPay. Без ключів LiqPay оплата лише імітується: гроші не
            списуються.
          </p>
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <p>{params.description ?? "Pro"}</p>
            <p className="text-lg font-semibold">{params.amount ?? "?"} грн</p>
            <p className="text-xs text-muted-foreground">
              {params.subscribe_periodicity === "year" ? "щороку" : "щомісяця"} · замовлення{" "}
              {orderId.slice(0, 11)}…
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/billing")}>
              Скасувати
            </Button>
            <Button className="flex-1" disabled={busy || !orderId} onClick={() => void pay()}>
              Оплатити (демо)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
