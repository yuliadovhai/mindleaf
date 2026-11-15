import { useRouter } from "../lib/router";
import { Button } from "./ui/button";
import { Lock } from "lucide-react";
import type { Plan } from "../api/types";

/** Shown to a tutor whose cabinet is read-only (Pro over, too many students). */
export function PlanBanner({ plan }: { plan: Plan | null }) {
  const { path, navigate } = useRouter();

  if (!plan?.read_only || path.startsWith("/billing")) return null;
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        Кабінет лише для перегляду: Pro закінчився, а активних учнів {plan.active_students} (на
        безкоштовному тарифі — до {plan.free_student_limit}).
      </span>
      <Button size="sm" onClick={() => navigate("/billing")}>
        Оформити Pro
      </Button>
    </div>
  );
}
