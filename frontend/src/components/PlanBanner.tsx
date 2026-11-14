import { useCallback } from "react";
import { useSession } from "../auth/session";
import { getPlan } from "../api/billing";
import { useLoad } from "../lib/useLoad";
import { useRouter } from "../lib/router";
import { Button } from "./ui/button";
import { Lock } from "lucide-react";

/** Shown to a tutor whose cabinet is read-only (Pro over, too many students). */
export function PlanBanner() {
  const { token } = useSession();
  const { path, navigate } = useRouter();
  const load = useCallback(() => getPlan(token), [token]);
  const { data } = useLoad(load);

  if (!data?.read_only || path.startsWith("/billing")) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        Кабінет лише для перегляду: Pro закінчився, а активних учнів {data.active_students} (на
        безкоштовному тарифі — до {data.free_student_limit}).
      </span>
      <Button size="sm" onClick={() => navigate("/billing")}>
        Оформити Pro
      </Button>
    </div>
  );
}
