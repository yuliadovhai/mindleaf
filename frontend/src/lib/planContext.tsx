import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useMe } from "../auth/me";
import { useSession } from "../auth/session";
import { getPlan } from "../api/billing";
import { useLoad } from "./useLoad";
import type { Plan } from "../api/types";

interface PlanContextValue {
  plan: Plan | null;
  planLoading: boolean;
  setPlan: (p: Plan) => void;
}

export const PlanContext = createContext<PlanContextValue>({
  plan: null,
  planLoading: false,
  setPlan: () => {},
});

export function usePlanContext(): PlanContextValue {
  return useContext(PlanContext);
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const { me } = useMe();
  const isTutor = me.role === "tutor";
  const load = useCallback(
    () => (isTutor ? getPlan(token) : Promise.resolve(null)),
    [isTutor, token]
  );
  const { data, setData, loading } = useLoad(load);
  const setPlan = useCallback((p: Plan) => setData(p), [setData]);

  return (
    <PlanContext.Provider value={{ plan: data ?? null, planLoading: isTutor && loading, setPlan }}>
      {children}
    </PlanContext.Provider>
  );
}
