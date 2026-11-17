import { createContext, useContext } from "react";
import type { Plan } from "../api/types";

interface PlanContextValue {
  plan: Plan | null;
  planLoading: boolean;
  setPlan: (p: Plan) => void;
}

export const PlanContext = createContext<PlanContextValue>({
  plan: null,
  planLoading: true,
  setPlan: () => {},
});

export function usePlanContext(): PlanContextValue {
  return useContext(PlanContext);
}
